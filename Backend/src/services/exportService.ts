import { ExportFormat, ExportStatus } from "@prisma/client";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { v4 as uuidv4 } from "uuid";

import { exportQueue, type ExportQueuePayload } from "../jobs/exportQueue";
import { withUserRls } from "../lib/rls";
import { AppError } from "../middleware/errorHandler";

interface CreateExportInput {
  userId: string;
  bookId: string;
  format: "EPUB" | "MOBI";
}

interface ExportStatusInput {
  userId: string;
  jobId: string;
}

const signedDownloadExpirySeconds = 10 * 60;

function getAwsConfig() {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET_NAME;

  if (!region || !accessKeyId || !secretAccessKey || !bucket) {
    throw new AppError(500, "AWS S3 environment variables are not fully configured");
  }

  return {
    bucket,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };
}

function getCdnUrl(s3Key: string) {
  const { bucket, region } = getAwsConfig();
  const cloudfrontUrl = process.env.CLOUDFRONT_URL?.replace(/\/+$/, "");

  if (cloudfrontUrl) {
    return `${cloudfrontUrl}/${s3Key}`;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
}

function createS3Client() {
  return new S3Client(getAwsConfig());
}

function getFileExtension(format: ExportFormat) {
  switch (format) {
    case ExportFormat.EPUB:
      return "epub";
    case ExportFormat.MOBI:
      return "mobi";
    default:
      return "bin";
  }
}

function isSupportedExportFormat(format: ExportFormat): format is "EPUB" | "MOBI" {
  return format === ExportFormat.EPUB || format === ExportFormat.MOBI;
}

async function runCommand(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripMarkupToText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .trim();
}

function formatInlineMarkdown(text: string) {
  let value = escapeHtml(text);

  value = value.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "<span>[$1]</span>");
  value = value.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  value = value.replace(/`([^`]+)`/g, "<code>$1</code>");
  value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  value = value.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  value = value.replace(/_([^_]+)_/g, "<em>$1</em>");
  value = value.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  return value;
}

function markdownToHtml(value: string) {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraphBuffer: string[] = [];
  let index = 0;

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) {
      return;
    }

    blocks.push(`<p>${formatInlineMarkdown(paragraphBuffer.join(" "))}</p>`);
    paragraphBuffer = [];
  };

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      blocks.push(`<h${level}>${formatInlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const line = lines[index].trim();
        const item = line.match(/^[-*]\s+(.+)$/);
        if (!item) {
          break;
        }
        items.push(`<li>${formatInlineMarkdown(item[1])}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const line = lines[index].trim();
        const item = line.match(/^\d+\.\s+(.+)$/);
        if (!item) {
          break;
        }
        items.push(`<li>${formatInlineMarkdown(item[1])}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    paragraphBuffer.push(trimmed);
    index += 1;
  }

  flushParagraph();

  return blocks.length > 0 ? blocks.join("\n") : "<p>This chapter is empty.</p>";
}

function normalizeChapterContent(content: string) {
  const trimmed = content.trim();
  if (!trimmed) {
    return "<p>This chapter is empty.</p>";
  }

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }

  return markdownToHtml(trimmed);
}

function buildDescriptionText(value: string | null) {
  if (!value) {
    return undefined;
  }

  const normalized = stripMarkupToText(value);
  return normalized.length > 0 ? normalized : undefined;
}

const epubCss = `
  body { font-family: serif; line-height: 1.55; margin: 0; padding: 0; }
  h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin-top: 1.2em; margin-bottom: 0.5em; }
  p { margin: 0 0 1em; text-align: justify; }
  ul, ol { margin: 0 0 1em 1.2em; }
  li { margin-bottom: 0.35em; }
  code { font-family: monospace; font-size: 0.95em; }
  a { text-decoration: underline; }
`;

export class ExportService {
  private s3Client?: S3Client;

  public async createExportJob(input: CreateExportInput) {
    const { bookId, format, userId } = input;

    const exportJob = await withUserRls(userId, async (tx) => {
      const book = await tx.book.findUnique({
        where: { id: bookId },
        select: { id: true },
      });

      if (!book) {
        throw new AppError(404, "Book not found");
      }

      return tx.exportJob.create({
        data: {
          bookId,
          format,
          status: ExportStatus.QUEUED,
          userId,
        },
        select: {
          id: true,
          bookId: true,
          format: true,
          userId: true,
        },
      });
    });

    if (!isSupportedExportFormat(exportJob.format)) {
      throw new AppError(400, "Unsupported export format. Use EPUB or MOBI.");
    }

    await exportQueue.add(
      "export",
      {
        bookId: exportJob.bookId,
        format: exportJob.format,
        jobId: exportJob.id,
        userId: exportJob.userId,
      },
      {
        jobId: exportJob.id,
      }
    );

    return { jobId: exportJob.id };
  }

  public async getExportStatus(input: ExportStatusInput) {
    const exportJob = await withUserRls(input.userId, async (tx) =>
      tx.exportJob.findUnique({
        where: { id: input.jobId },
        select: {
          status: true,
          fileUrl: true,
          errorMessage: true,
        },
      })
    );

    if (!exportJob) {
      throw new AppError(404, "Export job not found");
    }

    if (exportJob.status === ExportStatus.DONE && exportJob.fileUrl) {
      const s3Key = this.extractS3KeyFromUrl(exportJob.fileUrl);
      if (s3Key) {
        const signedUrl = await this.createSignedDownloadUrl(s3Key);

        return {
          ...exportJob,
          fileUrl: signedUrl,
        };
      }
    }

    return exportJob;
  }

  public async processQueuedExport(payload: ExportQueuePayload) {
    const { bookId, format, jobId, userId } = payload;
    let workspaceDir = "";

    try {
      const statusUpdated = await this.updateJobStatus(userId, jobId, {
        errorMessage: null,
        status: ExportStatus.PROCESSING,
      });
      if (!statusUpdated) {
        return;
      }

      const book = await withUserRls(userId, async (tx) =>
        tx.book.findUnique({
          where: { id: bookId },
          include: {
            chapters: {
              orderBy: { order: "asc" },
            },
            user: {
              select: {
                name: true,
              },
            },
          },
        })
      );

      if (!book) {
        throw new AppError(404, "Book not found");
      }

      workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "ebook-export-"));
      const outputPath = await this.generateBookExport({
        book,
        format,
        workspaceDir,
      });
      const fileBuffer = await fs.readFile(outputPath);
      const s3Key = `exports/${userId}/${bookId}/${uuidv4()}.${getFileExtension(format)}`;
      const fileUrl = await this.uploadExportFile(s3Key, fileBuffer, format);

      await this.updateJobStatus(userId, jobId, {
        errorMessage: null,
        fileUrl,
        status: ExportStatus.DONE,
      });
    } catch (error) {
      await this.updateJobStatus(userId, jobId, {
        errorMessage: error instanceof Error ? error.message : "Unknown export failure",
        status: ExportStatus.FAILED,
      });

      throw error;
    } finally {
      if (workspaceDir) {
        await fs.rm(workspaceDir, { force: true, recursive: true });
      }
    }
  }

  private async updateJobStatus(
    userId: string,
    jobId: string,
    data: {
      status: ExportStatus;
      fileUrl?: string | null;
      errorMessage?: string | null;
    }
  ) {
    return withUserRls(userId, async (tx) => {
      const result = await tx.exportJob.updateMany({
        where: {
          id: jobId,
          userId,
        },
        data,
      });

      return result.count > 0;
    });
  }

  private async generateBookExport(input: {
    book: {
      id: string;
      title: string;
      description: string | null;
      coverUrl: string | null;
      genre: string | null;
      user: {
        name: string;
      };
      chapters: Array<{
        title: string;
        content: string;
      }>;
    };
    format: ExportFormat;
    workspaceDir: string;
  }) {
    switch (input.format) {
      case ExportFormat.EPUB:
        return this.generateEpub(input.book, input.workspaceDir);
      case ExportFormat.MOBI:
        return this.generateMobi(input.book, input.workspaceDir);
      default:
        throw new AppError(400, "Unsupported export format. Use EPUB or MOBI.");
    }
  }

  private async generateEpub(
    book: {
      title: string;
      description: string | null;
      coverUrl: string | null;
      genre: string | null;
      user: {
        name: string;
      };
      chapters: Array<{
        title: string;
        content: string;
      }>;
    },
    workspaceDir: string
  ) {
    const outputPath = path.join(workspaceDir, "book.epub");
    const Epub = require("epub-gen");
    const description = buildDescriptionText(book.description);
    const option = {
      author: book.user.name || "Makia Author",
      css: epubCss,
      content: book.chapters.map((chapter) => ({
        data: normalizeChapterContent(chapter.content),
        title: chapter.title || "Untitled Chapter",
      })),
      cover: book.coverUrl ?? undefined,
      description,
      output: outputPath,
      publisher: "Makia",
      title: book.title || "Untitled Book",
    };

    await new Epub(option).promise;

    return outputPath;
  }

  private async generateMobi(
    book: {
      title: string;
      description: string | null;
      coverUrl: string | null;
      genre: string | null;
      user: {
        name: string;
      };
      chapters: Array<{
        title: string;
        content: string;
      }>;
    },
    workspaceDir: string
  ) {
    const epubPath = await this.generateEpub(book, workspaceDir);
    const mobiPath = path.join(workspaceDir, "book.mobi");
    const calibreBinary = process.env.CALIBRE_EBOOK_CONVERT_BIN ?? "ebook-convert";
    try {
      await runCommand(calibreBinary, [epubPath, mobiPath]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const looksLikeMissingBinary =
        message.includes("ENOENT") ||
        /not found/i.test(message) ||
        /ebook-convert/i.test(message);

      if (looksLikeMissingBinary) {
        throw new AppError(
          500,
          "MOBI export requires Calibre CLI. Install Calibre and ensure `ebook-convert` is available, or set `CALIBRE_EBOOK_CONVERT_BIN`."
        );
      }

      throw new AppError(500, `MOBI conversion failed: ${message || "Unknown Calibre error"}`);
    }

    return mobiPath;
  }

  private async uploadExportFile(
    s3Key: string,
    fileBuffer: Buffer,
    format: ExportFormat
  ) {
    const { bucket } = getAwsConfig();
    try {
      await this.getS3Client().send(
        new PutObjectCommand({
          Body: fileBuffer,
          Bucket: bucket,
          ContentType: this.getContentType(format),
          Key: s3Key,
        })
      );
    } catch (error) {
      const maybeS3 = error as {
        Code?: string;
        Endpoint?: string;
        message?: string;
      };

      if (maybeS3?.Code === "PermanentRedirect") {
        const endpointHint = maybeS3.Endpoint ? ` Use endpoint/region: ${maybeS3.Endpoint}.` : "";
        throw new AppError(
          500,
          `S3 bucket region mismatch.${endpointHint} Set AWS_REGION to the bucket region and restart API + worker.`
        );
      }

      throw error;
    }

    return getCdnUrl(s3Key);
  }

  private getContentType(format: ExportFormat) {
    switch (format) {
      case ExportFormat.EPUB:
        return "application/epub+zip";
      case ExportFormat.MOBI:
        return "application/x-mobipocket-ebook";
      default:
        return "application/octet-stream";
    }
  }

  private getS3Client() {
    this.s3Client ??= createS3Client();
    return this.s3Client;
  }

  private async createSignedDownloadUrl(s3Key: string) {
    const { bucket } = getAwsConfig();

    return getSignedUrl(
      this.getS3Client(),
      new GetObjectCommand({
        Bucket: bucket,
        Key: s3Key,
      }),
      {
        expiresIn: signedDownloadExpirySeconds,
      }
    );
  }

  private extractS3KeyFromUrl(fileUrl: string) {
    try {
      const parsed = new URL(fileUrl);
      const key = parsed.pathname.replace(/^\/+/, "");
      return key.length > 0 ? key : null;
    } catch {
      return null;
    }
  }
}

export const exportService = new ExportService();
