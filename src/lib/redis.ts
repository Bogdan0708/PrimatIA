import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!REDIS_URL) {
    throw new Error("REDIS_URL must be configured");
  }

  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
  }

  return connection;
}

export async function ensureRedisConnection(): Promise<IORedis> {
  const redis = getRedisConnection();

  if (redis.status === "wait") {
    await redis.connect();
  }

  return redis;
}
