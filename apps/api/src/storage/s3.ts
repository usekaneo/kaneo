import {
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createId } from "@paralleldrive/cuid2";
import { config } from "dotenv-mono";

config();

const DEFAULT_MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_PRESIGN_TTL_SECONDS = 300;

const allowedImageMimeTypes = new Set([
  "image/apng",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

type UploadSurface = "description" | "comment";

type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
  forcePathStyle: boolean;
  maxImageUploadBytes: number;
  presignTtlSeconds: number;
};

type TaskImageUploadContext = {
  workspaceId: string;
  projectId: string;
  taskId: string;
  surface: UploadSurface;
  filename: string;
  contentType: string;
};

type TaskImageUploadUrl = {
  key: string;
  uploadUrl: string;
  headers: Record<string, string>;
  assetUrl: string;
};

let clientCache:
  | {
      cacheKey: string;
      client: S3Client;
    }
  | undefined;

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === "") return fallback;
  return value.trim().toLowerCase() === "true";
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value?.trim() || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getStorageConfig(): StorageConfig {
  const endpoint = env("S3_ENDPOINT");
  const bucket = env("S3_BUCKET");
  const accessKeyId = env("S3_ACCESS_KEY_ID");
  const secretAccessKey = env("S3_SECRET_ACCESS_KEY");

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 uploads are not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.",
    );
  }

  return {
    endpoint,
    region: env("S3_REGION") || "us-east-1",
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: env("S3_PUBLIC_BASE_URL") || undefined,
    forcePathStyle: parseBoolean(process.env.S3_FORCE_PATH_STYLE, true),
    maxImageUploadBytes: parsePositiveInt(
      process.env.S3_MAX_IMAGE_UPLOAD_BYTES,
      DEFAULT_MAX_IMAGE_UPLOAD_BYTES,
    ),
    presignTtlSeconds: parsePositiveInt(
      process.env.S3_PRESIGN_TTL_SECONDS,
      DEFAULT_PRESIGN_TTL_SECONDS,
    ),
  };
}

function getMaxImageUploadBytes() {
  return parsePositiveInt(
    process.env.S3_MAX_IMAGE_UPLOAD_BYTES,
    DEFAULT_MAX_IMAGE_UPLOAD_BYTES,
  );
}

function getClient(config: StorageConfig) {
  const cacheKey = JSON.stringify({
    endpoint: config.endpoint,
    region: config.region,
    accessKeyId: config.accessKeyId,
    bucket: config.bucket,
    forcePathStyle: config.forcePathStyle,
  });

  if (clientCache?.cacheKey === cacheKey) {
    return clientCache.client;
  }

  const clientConfig: S3ClientConfig = {
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  };

  const client = new S3Client(clientConfig);
  clientCache = { cacheKey, client };
  return client;
}

function sanitizePathSegment(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "") || "file"
  );
}

function getFileExtension(filename: string) {
  const normalized = filename.trim();
  const extension = normalized.includes(".")
    ? normalized.split(".").pop() || ""
    : "";

  return sanitizePathSegment(extension).slice(0, 12);
}

function encodeKeyPath(key: string) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildAssetUrl(config: StorageConfig, key: string) {
  const encodedKey = encodeKeyPath(key);

  if (config.publicBaseUrl) {
    return new URL(
      encodedKey,
      `${config.publicBaseUrl.replace(/\/+$/, "")}/`,
    ).toString();
  }

  const endpoint = new URL(config.endpoint);

  if (config.forcePathStyle) {
    endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, "")}/${config.bucket}/${encodedKey}`;
    return endpoint.toString();
  }

  endpoint.hostname = `${config.bucket}.${endpoint.hostname}`;
  endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, "")}/${encodedKey}`;
  return endpoint.toString();
}

function buildObjectKey(context: TaskImageUploadContext) {
  const extension = getFileExtension(context.filename);
  const surfaceFolder =
    context.surface === "comment" ? "comments" : "descriptions";
  const timestamp = Date.now();
  const randomId = createId();

  const baseName = sanitizePathSegment(
    context.filename.replace(/\.[^/.]+$/, "") || "image",
  ).slice(0, 64);

  const fileName = extension
    ? `${baseName}-${timestamp}-${randomId}.${extension}`
    : `${baseName}-${timestamp}-${randomId}`;

  return [
    "workspace",
    sanitizePathSegment(context.workspaceId),
    "project",
    sanitizePathSegment(context.projectId),
    "task",
    sanitizePathSegment(context.taskId),
    surfaceFolder,
    fileName,
  ].join("/");
}

export function validateImageUploadInput(contentType: string, size: number) {
  const maxImageUploadBytes = getMaxImageUploadBytes();

  if (!allowedImageMimeTypes.has(contentType.toLowerCase())) {
    throw new Error("Only image uploads are supported.");
  }

  if (size <= 0) {
    throw new Error("Image upload size must be greater than zero.");
  }

  if (size > maxImageUploadBytes) {
    throw new Error(
      `Image exceeds the maximum upload size of ${Math.floor(maxImageUploadBytes / (1024 * 1024))}MB.`,
    );
  }
}

export async function createTaskImageUploadUrl(
  context: TaskImageUploadContext,
): Promise<TaskImageUploadUrl> {
  const config = getStorageConfig();
  const client = getClient(config);
  const key = buildObjectKey(context);

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: context.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: config.presignTtlSeconds,
  });

  return {
    key,
    uploadUrl,
    headers: {
      "Content-Type": context.contentType,
    },
    assetUrl: buildAssetUrl(config, key),
  };
}

export function assertStorageConfigured() {
  return getStorageConfig();
}
