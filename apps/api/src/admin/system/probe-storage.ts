import { headStorageBucket, isStorageConfigured } from "../../storage/s3";
import { safeErrorCode } from "./safe-error-code";
import type { ServiceStatus } from "./service-status";
import { withTimeout } from "./with-timeout";

type StorageProbe = {
  status: ServiceStatus;
  configured: boolean;
  errorCode: string | null;
};

const STORAGE_ENV = [
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];

function httpStatus(error: unknown) {
  const status = (error as { $metadata?: { httpStatusCode?: unknown } })
    ?.$metadata?.httpStatusCode;
  return typeof status === "number" ? status : undefined;
}

/**
 * A 403 means the bucket answered but these credentials may not list it,
 * which upload-only IAM policies do on purpose. Report that as a warning.
 */
export function storageFailureStatus(error: unknown): ServiceStatus {
  return httpStatus(error) === 403 ? "warning" : "down";
}

export async function probeStorage(timeoutMs: number): Promise<StorageProbe> {
  if (!isStorageConfigured()) {
    const partlySet = STORAGE_ENV.some((name) => process.env[name]?.trim());
    return partlySet
      ? { status: "warning", configured: false, errorCode: "INCOMPLETE_CONFIG" }
      : { status: "not_configured", configured: false, errorCode: null };
  }

  try {
    await withTimeout((signal) => headStorageBucket(signal), timeoutMs);
    return { status: "ok", configured: true, errorCode: null };
  } catch (error) {
    const status = httpStatus(error);
    return {
      status: storageFailureStatus(error),
      configured: true,
      errorCode: status ? `HTTP_${status}` : safeErrorCode(error),
    };
  }
}
