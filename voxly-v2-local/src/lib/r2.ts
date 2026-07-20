import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials missing. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY."
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME is required.");
  return bucket;
}

export function getPublicObjectUrl(key: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("R2_PUBLIC_BASE_URL is required for public video URLs.");
  }
  return `${base}/${key}`;
}

export async function uploadLocalFile(
  absoluteFilePath: string,
  objectKey: string,
  contentType = "video/mp4"
): Promise<string> {
  if (!fs.existsSync(absoluteFilePath)) {
    throw new Error(`File not found: ${absoluteFilePath}`);
  }

  const body = fs.readFileSync(absoluteFilePath);
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    })
  );

  return getPublicObjectUrl(objectKey);
}

export async function getPresignedGetUrl(
  objectKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: objectKey,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export function exportKeyForProject(projectId: string): string {
  return `exports/${projectId}.mp4`;
}

export function resolvePublicMediaPath(webPath: string): string {
  const normalized = webPath.startsWith("/") ? webPath.slice(1) : webPath;
  return path.join(process.cwd(), "public", normalized);
}
