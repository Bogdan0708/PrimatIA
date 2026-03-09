import { afterEach, describe, expect, it } from "vitest";
import { getStorageConfig } from "@/lib/storage";

const ORIGINAL_ENV = { ...process.env };

describe("storage configuration", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("keeps local defaults outside production", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "development",
    };
    delete process.env.MINIO_ENDPOINT;
    delete process.env.MINIO_PORT;
    delete process.env.MINIO_ACCESS_KEY;
    delete process.env.MINIO_SECRET_KEY;
    delete process.env.MINIO_BUCKET;

    expect(getStorageConfig()).toEqual(
      expect.objectContaining({
        endPoint: "localhost",
        port: 9000,
        accessKey: "primaria_minio",
        secretKey: "primaria_minio_secret",
        bucketName: "primaria-documents",
      })
    );
  });

  it("fails hard in production when storage settings are missing", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
    };
    delete process.env.MINIO_ENDPOINT;
    delete process.env.MINIO_PORT;
    delete process.env.MINIO_ACCESS_KEY;
    delete process.env.MINIO_SECRET_KEY;
    delete process.env.MINIO_BUCKET;

    expect(() => getStorageConfig()).toThrow(
      /Missing required production storage configuration/
    );
  });
});
