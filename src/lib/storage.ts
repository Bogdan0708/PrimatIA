import { Client } from "minio";

const DEFAULT_BUCKET_NAME = "primaria-documents";
const DEFAULT_ENDPOINT = "localhost";
const DEFAULT_PORT = 9000;
const DEFAULT_ACCESS_KEY = "primaria_minio";
const DEFAULT_SECRET_KEY = "primaria_minio_secret";

let minioClient: Client | null = null;

export function getStorageConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  const endpoint = process.env.MINIO_ENDPOINT;
  const port = process.env.MINIO_PORT;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  const bucketName = process.env.MINIO_BUCKET || DEFAULT_BUCKET_NAME;

  if (isProduction) {
    const missing = [
      !endpoint ? "MINIO_ENDPOINT" : null,
      !port ? "MINIO_PORT" : null,
      !accessKey ? "MINIO_ACCESS_KEY" : null,
      !secretKey ? "MINIO_SECRET_KEY" : null,
      !process.env.MINIO_BUCKET ? "MINIO_BUCKET" : null,
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new Error(
        `Missing required production storage configuration: ${missing.join(", ")}`
      );
    }
  }

  return {
    endPoint: endpoint || DEFAULT_ENDPOINT,
    port: parseInt(port || String(DEFAULT_PORT), 10),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: accessKey || DEFAULT_ACCESS_KEY,
    secretKey: secretKey || DEFAULT_SECRET_KEY,
    bucketName,
  };
}

function getClient(): Client {
  if (!minioClient) {
    const config = getStorageConfig();
    minioClient = new Client({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
  }
  return minioClient;
}

/**
 * Ensure the documents bucket exists.
 */
async function ensureBucket(): Promise<void> {
  const client = getClient();
  const { bucketName } = getStorageConfig();
  const exists = await client.bucketExists(bucketName);
  if (!exists) {
    await client.makeBucket(bucketName);
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
  const { bucketName } = getStorageConfig();
  await client.putObject(bucketName, path, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return path;
}

/**
 * Download a file from MinIO as a Buffer.
 */
export async function downloadFile(path: string): Promise<Buffer> {
  const client = getClient();
  const { bucketName } = getStorageConfig();
  const stream = await client.getObject(bucketName, path);
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
  const { bucketName } = getStorageConfig();
  return client.presignedGetObject(bucketName, path, expirySeconds);
}

/**
 * Delete a file from MinIO.
 */
export async function deleteFile(path: string): Promise<void> {
  const client = getClient();
  const { bucketName } = getStorageConfig();
  await client.removeObject(bucketName, path);
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
