import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) return null;

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function extractObjectKey(cloudExportUrl) {
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!base || !cloudExportUrl?.startsWith(base)) return null;
  return cloudExportUrl.slice(base.length + 1);
}

export function exportKeyForProject(projectId) {
  return `exports/${projectId}.mp4`;
}

/** Deletes the R2 object if credentials are configured. Returns whether deletion was attempted. */
export async function deleteCloudVideo({ projectId, cloudExportUrl }) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!client || !bucket) return { attempted: false, deleted: false };

  const key = extractObjectKey(cloudExportUrl) || exportKeyForProject(projectId);

  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return { attempted: true, deleted: true, key };
  } catch (err) {
    return { attempted: true, deleted: false, error: err.message };
  }
}
