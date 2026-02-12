import { Client } from "minio";

const BUCKET_NAME = process.env.MINIO_BUCKET || "primaria-documents";

let minioClient: Client | null = null;

function getClient(): Client {
  if (!minioClient) {
    minioClient = new Client({
      endPoint: process.env.MINIO_ENDPOINT || "localhost",
      port: parseInt(process.env.MINIO_PORT || "9000"),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY || "primaria_minio",
      secretKey: process.env.MINIO_SECRET_KEY || "primaria_minio_secret",
    });
  }
  return minioClient;
}

/**
 * Ensure the documents bucket exists.
 */
async function ensureBucket(): Promise<void> {
  const client = getClient();
  const exists = await client.bucketExists(BUCKET_NAME);
  if (!exists) {
    await client.makeBucket(BUCKET_NAME);
  }
}

/**
 * Upload a file (Buffer) to MinIO.
 * Returns the object path (key).
 */
export async function uploadFile(
  path: string,
  buffer: Buffer,
  contentType: string = "application/pdf"
): Promise<string> {
  await ensureBucket();
  const client = getClient();
  await client.putObject(BUCKET_NAME, path, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return path;
}

/**
 * Download a file from MinIO as a Buffer.
 */
export async function downloadFile(path: string): Promise<Buffer> {
  const client = getClient();
  const stream = await client.getObject(BUCKET_NAME, path);
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/**
 * Generate a pre-signed URL for downloading (valid for 1 hour by default).
 */
export async function getPresignedUrl(
  path: string,
  expirySeconds: number = 3600
): Promise<string> {
  const client = getClient();
  return client.presignedGetObject(BUCKET_NAME, path, expirySeconds);
}

/**
 * Delete a file from MinIO.
 */
export async function deleteFile(path: string): Promise<void> {
  const client = getClient();
  await client.removeObject(BUCKET_NAME, path);
}

/**
 * Build a storage path for a document.
 * Format: {tenantId}/{year}/{type}/{filename}
 */
export function buildDocumentPath(
  tenantId: string,
  documentType: string,
  filename: string,
  year?: number
): string {
  const y = year ?? new Date().getFullYear();
  return `${tenantId}/${y}/${documentType}/${filename}`;
}
