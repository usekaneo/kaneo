import { Readable } from "node:stream";
import {
  GetObjectCommand,
  HeadObjectCommand,
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

export function isImageContentType(contentType: string) {
  return allowedImageMimeTypes.has(contentType.toLowerCase());
}

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
};

type AssetObject = {
  body: unknown;
  contentType: string | undefined;
  contentLength: number | undefined;
  etag: string | undefined;
  lastModified: Date | undefined;
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

function buildObjectKeyPrefix(
  context: Omit<TaskImageUploadContext, "filename" | "contentType">,
) {
  const surfaceFolder =
    context.surface === "comment" ? "comments" : "descriptions";

  return [
    "workspace",
    sanitizePathSegment(context.workspaceId),
    "project",
    sanitizePathSegment(context.projectId),
    "task",
    sanitizePathSegment(context.taskId),
    surfaceFolder,
  ].join("/");
}

function buildObjectKey(context: TaskImageUploadContext) {
  const extension = getFileExtension(context.filename);
  const objectKeyPrefix = buildObjectKeyPrefix(context);
  const timestamp = Date.now();
  const randomId = createId();

  const baseName = sanitizePathSegment(
    context.filename.replace(/\.[^/.]+$/, "") || "image",
  ).slice(0, 64);

  const fileName = extension
    ? `${baseName}-${timestamp}-${randomId}.${extension}`
    : `${baseName}-${timestamp}-${randomId}`;

  return `${objectKeyPrefix}/${fileName}`;
}

export function validateTaskAssetUploadInput(
  contentType: string,
  size: number,
) {
  const maxImageUploadBytes = getMaxImageUploadBytes();

  if (!contentType.trim()) {
    throw new Error("A valid content type is required.");
  }

  if (size <= 0) {
    throw new Error("Upload size must be greater than zero.");
  }

  if (size > maxImageUploadBytes) {
    throw new Error(
      `Upload exceeds the maximum upload size of ${Math.floor(maxImageUploadBytes / (1024 * 1024))}MB.`,
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
  };
}

export function assertStorageConfigured() {
  return getStorageConfig();
}

export function assertTaskImageKeyMatchesContext(
  key: string,
  context: Omit<TaskImageUploadContext, "filename" | "contentType">,
) {
  const prefix = `${buildObjectKeyPrefix(context)}/`;
  return key.startsWith(prefix);
}

export async function assertObjectExists(key: string) {
  const config = getStorageConfig();
  const client = getClient(config);

  await client.send(
    new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );
}

export async function getPrivateObject(key: string): Promise<AssetObject> {
  const config = getStorageConfig();
  const client = getClient(config);
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error("Storage object body is missing.");
  }

  const body =
    "transformToWebStream" in response.Body
      ? response.Body.transformToWebStream()
      : Readable.toWeb(response.Body as Readable);

  return {
    body,
    contentType: response.ContentType,
    contentLength: response.ContentLength,
    etag: response.ETag,
    lastModified: response.LastModified,
  };
}
