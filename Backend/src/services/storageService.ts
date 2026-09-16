import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "node:path";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

import { withUserRls } from "../lib/rls";
import { createStorageClient, getPublicUrl, getStorageConfig } from "../lib/storage";
import { AppError } from "../middleware/errorHandler";

interface PresignUploadInput {
  userId: string;
  fileName: string;
  fileType: string;
  bookId: string;
  assetKind?: "cover" | "image" | "file";
}

interface ConfirmUploadInput {
  userId: string;
  s3Key: string;
  bookId: string;
  fileType: string;
  assetKind?: "cover" | "image" | "file";
}

const presignedUrlExpirySeconds = 5 * 60;

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function inferAssetFolder(
  fileName: string,
  fileType: string,
  assetKind?: "cover" | "image" | "file"
) {
  if (assetKind === "cover") {
    return "covers";
  }

  if (assetKind === "image") {
    return "images";
  }

  if (assetKind === "file") {
    return "files";
  }

  if (fileType.startsWith("image/")) {
    return /cover/i.test(fileName) ? "covers" : "images";
  }

  return "files";
}

function getResizeOptions(input: {
  fileName: string;
  fileType: string;
  s3Key: string;
  assetKind?: "cover" | "image" | "file";
}) {
  if (input.assetKind === "cover" || /\/covers\//i.test(input.s3Key)) {
    return {
      fit: "inside" as const,
      height: 1200,
      width: 800,
    };
  }

  if (input.assetKind === "file") {
    return null;
  }

  const { fileName, fileType } = input;

  if (!fileType.startsWith("image/")) {
    return null;
  }

  if (/cover/i.test(fileName)) {
    return {
      fit: "inside" as const,
      height: 1200,
      width: 800,
    };
  }

  return {
    fit: "inside" as const,
    width: 1200,
  };
}

async function streamToBuffer(
  body:
    | {
        transformToByteArray: () => Promise<Uint8Array>;
      }
    | undefined
) {
  if (!body) {
    throw new AppError(500, "S3 object body is not readable");
  }

  const bytes = await body.transformToByteArray();
  return Buffer.from(bytes);
}

export class StorageService {
  private s3Client?: S3Client;

  public async createPresignedUpload(input: PresignUploadInput) {
    const { fileName, fileType, userId, bookId, assetKind } = input;
    const extension = path.extname(fileName);
    const assetFolder = inferAssetFolder(fileName, fileType, assetKind);
    const normalizedName = sanitizeFileName(path.basename(fileName, extension));
    const s3Key = `users/${userId}/books/${bookId}/${assetFolder}/${uuidv4()}-${normalizedName}${extension}`;

    await this.assertBookOwnership(userId, bookId);

    const command = new PutObjectCommand({
      Bucket: getStorageConfig().bucket,
      ContentType: fileType,
      Key: s3Key,
    });

    const presignedUrl = await getSignedUrl(this.getS3Client(), command, {
      expiresIn: presignedUrlExpirySeconds,
    });

    return {
      presignedUrl,
      s3Key,
      cdnUrl: getPublicUrl(s3Key),
    };
  }

  public async confirmUpload(input: ConfirmUploadInput) {
    const { bookId, fileType, s3Key, userId, assetKind } = input;
    const cdnUrl = getPublicUrl(s3Key);

    await withUserRls(userId, async (tx) => {
      const book = await tx.book.findUnique({
        where: { id: bookId },
        select: { id: true },
      });

      if (!book) {
        throw new AppError(404, "Book not found");
      }

      await tx.assetUpload.create({
        data: {
          bookId,
          cdnUrl,
          fileType,
          s3Key,
          userId,
        },
      });
    });

    if (fileType.startsWith("image/")) {
      void this.resizeImageVariant({
        assetKind,
        fileName: s3Key,
        fileType,
        s3Key,
      });
    }

    return { cdnUrl };
  }

  private async assertBookOwnership(userId: string, bookId: string) {
    const book = await withUserRls(userId, async (tx) =>
      tx.book.findUnique({
        where: { id: bookId },
        select: { id: true },
      })
    );

    if (!book) {
      throw new AppError(404, "Book not found");
    }
  }

  private async resizeImageVariant(input: {
    assetKind?: "cover" | "image" | "file";
    fileName: string;
    fileType: string;
    s3Key: string;
  }) {
    const resizeOptions = getResizeOptions(input);

    if (!resizeOptions) {
      return;
    }

    const { bucket } = getStorageConfig();
    const object = await this.getS3Client().send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: input.s3Key,
      })
    );
    const originalBuffer = await streamToBuffer(object.Body);
    const resizedBuffer = await sharp(originalBuffer).resize(resizeOptions).webp().toBuffer();
    const resizedKey = `resized/${input.s3Key.replace(path.extname(input.s3Key), ".webp")}`;

    await this.getS3Client().send(
      new PutObjectCommand({
        Body: resizedBuffer,
        Bucket: bucket,
        ContentType: "image/webp",
        Key: resizedKey,
      })
    );
  }

  private getS3Client() {
    this.s3Client ??= createStorageClient();
    return this.s3Client;
  }
}

export const storageService = new StorageService();
