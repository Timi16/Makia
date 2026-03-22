import { ExportFormat, ExportStatus } from "@prisma/client";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { v4 as uuidv4 } from "uuid";
import puppeteer from "puppeteer";

import { exportQueue, type ExportQueuePayload } from "../jobs/exportQueue";
import { withUserRls } from "../lib/rls";
import { AppError } from "../middleware/errorHandler";

interface CreateExportInput {
  userId: string;
  bookId: string;
  format: "PDF" | "EPUB" | "MOBI";
}

interface ExportStatusInput {
  userId: string;
  jobId: string;
}

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createS3Client() {
  return new S3Client(getAwsConfig());
}

function getFileExtension(format: ExportFormat) {
  switch (format) {
    case ExportFormat.PDF:
      return "pdf";
    case ExportFormat.EPUB:
      return "epub";
    case ExportFormat.MOBI:
      return "mobi";
    default:
      return "bin";
  }
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

    return exportJob;
  }

  public async processQueuedExport(payload: ExportQueuePayload) {
    const { bookId, format, jobId, userId } = payload;
    let workspaceDir = "";

    try {
      await this.updateJobStatus(userId, jobId, {
        errorMessage: null,
        status: ExportStatus.PROCESSING,
      });

      const book = await withUserRls(userId, async (tx) =>
        tx.book.findUnique({
          where: { id: bookId },
          include: {
            chapters: {
              orderBy: { order: "asc" },
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
    await withUserRls(userId, async (tx) => {
      await tx.exportJob.update({
        where: { id: jobId },
        data,
      });
    });
  }

  private async generateBookExport(input: {
    book: {
      id: string;
      title: string;
      description: string | null;
      coverUrl: string | null;
      genre: string | null;
      chapters: Array<{
        title: string;
        content: string;
      }>;
    };
    format: ExportFormat;
    workspaceDir: string;
  }) {
    switch (input.format) {
      case ExportFormat.PDF:
        return this.generatePdf(input.book, input.workspaceDir);
      case ExportFormat.EPUB:
        return this.generateEpub(input.book, input.workspaceDir);
      case ExportFormat.MOBI:
        return this.generateMobi(input.book, input.workspaceDir);
      default:
        throw new AppError(400, "Unsupported export format");
    }
  }

  private async generatePdf(
    book: {
      title: string;
      description: string | null;
      chapters: Array<{
        title: string;
        content: string;
      }>;
    },
    workspaceDir: string
  ) {
    const html = this.renderBookHtml(book);
    const outputPath = path.join(workspaceDir, "book.pdf");
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: true,
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      await page.pdf({
        format: "A4",
        margin: {
          top: "24mm",
          right: "18mm",
          bottom: "24mm",
          left: "18mm",
        },
        path: outputPath,
        printBackground: true,
      });
    } finally {
      await browser.close();
    }

    return outputPath;
  }

  private async generateEpub(
    book: {
      title: string;
      description: string | null;
      coverUrl: string | null;
      genre: string | null;
      chapters: Array<{
        title: string;
        content: string;
      }>;
    },
    workspaceDir: string
  ) {
    const outputPath = path.join(workspaceDir, "book.epub");
    const Epub = require("epub-gen");
    const option = {
      author: "E-Book Maker",
      content: book.chapters.map((chapter) => ({
        data: chapter.content,
        title: chapter.title,
      })),
      cover: book.coverUrl ?? undefined,
      description: book.description ?? undefined,
      output: outputPath,
      publisher: "E-Book Maker",
      title: book.title,
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

    await runCommand(calibreBinary, [epubPath, mobiPath]);

    return mobiPath;
  }

  private renderBookHtml(book: {
    title: string;
    description: string | null;
    chapters: Array<{
      title: string;
      content: string;
    }>;
  }) {
    const sections = book.chapters
      .map(
        (chapter) => `
          <section class="chapter">
            <h2>${escapeHtml(chapter.title)}</h2>
            <div class="content">${chapter.content}</div>
          </section>
        `
      )
      .join("");

    return `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(book.title)}</title>
          <style>
            body {
              color: #1f2933;
              font-family: Georgia, serif;
              line-height: 1.7;
              margin: 0 auto;
              max-width: 720px;
              padding: 48px 32px;
            }

            h1,
            h2 {
              font-family: "Palatino Linotype", serif;
              line-height: 1.2;
            }

            .description {
              color: #52606d;
              margin-bottom: 40px;
            }

            .chapter {
              break-inside: avoid;
              margin-bottom: 32px;
            }
          </style>
        </head>
        <body>
          <header>
            <h1>${escapeHtml(book.title)}</h1>
            ${book.description ? `<p class="description">${escapeHtml(book.description)}</p>` : ""}
          </header>
          ${sections}
        </body>
      </html>
    `;
  }

  private async uploadExportFile(
    s3Key: string,
    fileBuffer: Buffer,
    format: ExportFormat
  ) {
    const { bucket } = getAwsConfig();

    await this.getS3Client().send(
      new PutObjectCommand({
        Body: fileBuffer,
        Bucket: bucket,
        ContentType: this.getContentType(format),
        Key: s3Key,
      })
    );

    return getCdnUrl(s3Key);
  }

  private getContentType(format: ExportFormat) {
    switch (format) {
      case ExportFormat.PDF:
        return "application/pdf";
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
}

export const exportService = new ExportService();
