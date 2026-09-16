import { S3Client } from "@aws-sdk/client-s3";

import { AppError } from "../middleware/errorHandler";

export function getStorageConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new AppError(500, "Cloudflare R2 environment variables are not fully configured");
  }

  return {
    bucket,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };
}

export function createStorageClient() {
  const { credentials, endpoint } = getStorageConfig();

  return new S3Client({
    credentials,
    endpoint,
    // R2 ignores the region but the SDK requires one.
    region: "auto",
  });
}

export function getPublicUrl(key: string) {
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");

  if (publicBase) {
    return `${publicBase}/${key}`;
  }

  const { bucket, endpoint } = getStorageConfig();
  return `${endpoint}/${bucket}/${key}`;
}

export function extractKeyFromUrl(fileUrl: string) {
  try {
    const parsed = new URL(fileUrl);
    let key = parsed.pathname.replace(/^\/+/, "");

    // Path-style R2 endpoint URLs include the bucket as the first segment.
    const { bucket } = getStorageConfig();
    if (parsed.hostname.endsWith(".r2.cloudflarestorage.com") && key.startsWith(`${bucket}/`)) {
      key = key.slice(bucket.length + 1);
    }

    return key.length > 0 ? key : null;
  } catch {
    return null;
  }
}
