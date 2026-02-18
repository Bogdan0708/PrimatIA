import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}

// ============================================================================
// Queue Definitions
// ============================================================================

export const QUEUE_NAMES = {
  DOCUMENT_GENERATION: "document-generation",
  BATCH_DOCUMENTS: "batch-documents",
  PATRIMVEN_EXPORT: "patrimven-export",
  REPORT_GENERATION: "report-generation",
  SOMATIE_GENERATION: "somatie-generation",
  NOTIFICATION_BATCH: "notification-batch",
} as const;

const queues: Map<string, Queue> = new Map();

export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    queues.set(name, new Queue(name, { connection: getConnection() }));
  }
  return queues.get(name)!;
}

// ============================================================================
// Job Data Types
// ============================================================================

export interface BatchDocumentJobData {
  tenantId: string;
  userId: string;
  fiscalYear: number;
  documentType: "decizie_impunere";
  contribuabilIds?: string[]; // if empty, generate for all
}

export interface PatrimvenExportJobData {
  tenantId: string;
  userId: string;
  formType: "F3001" | "F3002" | "F3003" | "F3101";
  fiscalYear: number;
  exportJobId: string;
}

export interface ReportJobData {
  tenantId: string;
  userId: string;
  reportType: string;
  parameters: Record<string, unknown>;
  exportJobId: string;
}

export interface SomatieGenerationJobData {
  tenantId: string;
  userId: string;
  cutoffDate: string; // ISO date
  exportJobId: string;
}

export interface NotificationBatchJobData {
  tenantId: string;
  userId: string;
  templateCode: string;
  channel: "email" | "sms" | "push";
  recipientIds: string[];
  parameters: Record<string, unknown>;
}

// ============================================================================
// Helper to add jobs
// ============================================================================

export async function addBatchDocumentJob(data: BatchDocumentJobData) {
  const queue = getQueue(QUEUE_NAMES.BATCH_DOCUMENTS);
  return queue.add("batch-generate", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}

export async function addPatrimvenExportJob(data: PatrimvenExportJobData) {
  const queue = getQueue(QUEUE_NAMES.PATRIMVEN_EXPORT);
  return queue.add("patrimven-export", data, {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
  });
}

export async function addReportJob(data: ReportJobData) {
  const queue = getQueue(QUEUE_NAMES.REPORT_GENERATION);
  return queue.add("report-generate", data, {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
  });
}

export async function addSomatieGenerationJob(data: SomatieGenerationJobData) {
  const queue = getQueue(QUEUE_NAMES.SOMATIE_GENERATION);
  return queue.add("somatie-generate", data, {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
  });
}

export async function addNotificationBatchJob(data: NotificationBatchJobData) {
  const queue = getQueue(QUEUE_NAMES.NOTIFICATION_BATCH);
  return queue.add("notification-batch", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}

// ============================================================================
// Worker creation helper (used by worker process)
// ============================================================================

export function createWorker<T>(
  queueName: string,
  processor: (job: Job<T>) => Promise<void>
): Worker<T> {
  return new Worker<T>(queueName, processor, {
    connection: getConnection(),
    concurrency: 2,
  });
}
