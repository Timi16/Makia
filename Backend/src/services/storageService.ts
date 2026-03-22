import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "node:path";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

import { withUserRls } from "../lib/rls";
import { AppError } from "../middleware/errorHandler";

interface PresignUploadInput {
  userId: string;
  fileName: string;
  fileType: string;
  bookId: string;
}

interface ConfirmUploadInput {
  userId: string;
  s3Key: string;
  bookId: string;
  fileType: string;
}

const presignedUrlExpirySeconds = 5 * 60;

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

function createS3Client() {
  return new S3Client(getAwsConfig());
}

function getCdnUrl(s3Key: string) {
  const { bucket, region } = getAwsConfig();
  const cloudfrontUrl = process.env.CLOUDFRONT_URL?.replace(/\/+$/, "");

  if (cloudfrontUrl) {
    return `${cloudfrontUrl}/${s3Key}`;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function inferAssetFolder(fileName: string, fileType: string) {
  if (fileType.startsWith("image/")) {
    return /cover/i.test(fileName) ? "covers" : "images";
  }

  return "files";
}

function getResizeOptions(fileName: string, fileType: string) {
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
    const { fileName, fileType, userId, bookId } = input;
    const extension = path.extname(fileName);
    const assetFolder = inferAssetFolder(fileName, fileType);
    const normalizedName = sanitizeFileName(path.basename(fileName, extension));
    const s3Key = `users/${userId}/books/${bookId}/${assetFolder}/${uuidv4()}-${normalizedName}${extension}`;

    await this.assertBookOwnership(userId, bookId);

    const command = new PutObjectCommand({
      Bucket: getAwsConfig().bucket,
      ContentType: fileType,
      Key: s3Key,
    });

    const presignedUrl = await getSignedUrl(this.getS3Client(), command, {
      expiresIn: presignedUrlExpirySeconds,
    });

    return {
      presignedUrl,
      s3Key,
      cdnUrl: getCdnUrl(s3Key),
    };
  }

  public async confirmUpload(input: ConfirmUploadInput) {
    const { bookId, fileType, s3Key, userId } = input;
    const cdnUrl = getCdnUrl(s3Key);

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
    fileName: string;
    fileType: string;
    s3Key: string;
  }) {
    const resizeOptions = getResizeOptions(input.fileName, input.fileType);

    if (!resizeOptions) {
      return;
    }

    const { bucket } = getAwsConfig();
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
    this.s3Client ??= createS3Client();
    return this.s3Client;
  }
}

export const storageService = new StorageService();
