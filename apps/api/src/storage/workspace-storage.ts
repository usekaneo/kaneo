import { createHash } from "node:crypto";
import type { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { storedFileTable, workspaceStorageTable } from "../database/schema";
import {
  assertPublicDestination,
  privateDestinationsAllowed,
} from "../utils/assert-public-destination";
import { openSecret } from "../utils/secret-box";

export type BucketConfig = {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  keyPrefix: string;
};

// Postgres is fine for receipts and documents; big media belongs in R2.
export const DB_MAX_BYTES = 10 * 1024 * 1024;
// The bundled nginx accepts 25 MB request bodies.
export const BUCKET_MAX_BYTES = 25 * 1024 * 1024;

const clients = new Map<string, S3Client>();

function clientFor(config: BucketConfig) {
  const cacheKey = createHash("sha256")
    .update(
      JSON.stringify([
        config.endpoint,
        config.region,
        config.accessKeyId,
        config.secretAccessKey,
      ]),
    )
    .digest("hex");
  let client = clients.get(cacheKey);
  if (!client) {
    client = new S3Client({
      endpoint: config.endpoint,
      region: config.region || "auto",
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // R2 rejects the SDK's default hoisted checksums on some requests.
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
    clients.set(cacheKey, client);
  }
  return client;
}

export async function getBucketConfig(
  workspaceId: string,
): Promise<BucketConfig | null> {
  const [row] = await db
    .select()
    .from(workspaceStorageTable)
    .where(eq(workspaceStorageTable.workspaceId, workspaceId));
  if (!row) return null;
  return {
    endpoint: row.endpoint,
    bucket: row.bucket,
    region: row.region,
    accessKeyId: row.accessKeyId,
    secretAccessKey: openSecret(row.secretAccessKey),
    keyPrefix: row.keyPrefix,
  };
}

function objectKey(
  config: BucketConfig,
  workspaceId: string,
  filename: string,
) {
  const safe = filename.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80) || "file";
  const prefix = config.keyPrefix.replace(/^\/+|\/+$/g, "");
  return [prefix, "workspaces", workspaceId, "files", `${createId()}-${safe}`]
    .filter(Boolean)
    .join("/");
}

/** Checks that Kaneo can write and delete in the bucket before saving. */
export async function testBucket(config: BucketConfig) {
  // The server connects to whatever endpoint an admin types, so it has to be
  // a public HTTPS host, never an address inside the server's own network.
  // Self-hosters with a MinIO next door opt in the same way as for webhooks.
  let url: URL;
  try {
    url = new URL(config.endpoint);
  } catch {
    throw new HTTPException(400, { message: "The endpoint isn't a valid URL" });
  }
  if (
    url.protocol !== "https:" &&
    !(privateDestinationsAllowed() && url.protocol === "http:")
  ) {
    throw new HTTPException(400, { message: "The endpoint must use https" });
  }
  try {
    await assertPublicDestination(config.endpoint, "Storage endpoint");
  } catch {
    throw new HTTPException(400, {
      message: "The endpoint must be a public address",
    });
  }

  const client = clientFor(config);
  const key = [
    config.keyPrefix.replace(/^\/+|\/+$/g, ""),
    `.kaneo-check-${createId()}`,
  ]
    .filter(Boolean)
    .join("/");
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: "ok",
        ContentType: "text/plain",
      }),
    );
    await client.send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
    );
  } catch (error) {
    // Only the S3 error code (NoSuchBucket, AccessDenied, ...), never the
    // response text, which could be anything the endpoint chose to send.
    const code =
      error instanceof Error && /^[A-Za-z]{2,64}$/.test(error.name)
        ? ` (${error.name})`
        : "";
    throw new HTTPException(400, {
      message: `Couldn't write to the bucket${code}. Check the endpoint, bucket name and keys.`,
    });
  }
}

type StoreInput = {
  workspaceId: string;
  uploadedBy: string;
  filename: string;
  mimeType: string;
  bytes: Buffer;
  kind: "file" | "receipt";
  folder?: string;
};

/** Stores bytes in the workspace bucket when there is one, else Postgres. */
export async function storeBlob(input: StoreInput) {
  const bucket = await getBucketConfig(input.workspaceId);
  const limit = bucket ? BUCKET_MAX_BYTES : DB_MAX_BYTES;
  if (input.bytes.length > limit) {
    throw new HTTPException(413, {
      message: bucket
        ? "Files can be at most 25 MB"
        : "Files can be at most 10 MB until file storage (R2) is connected",
    });
  }

  let objectKeyValue: string | null = null;
  if (bucket) {
    objectKeyValue = objectKey(bucket, input.workspaceId, input.filename);
    await clientFor(bucket).send(
      new PutObjectCommand({
        Bucket: bucket.bucket,
        Key: objectKeyValue,
        Body: input.bytes,
        ContentType: input.mimeType,
      }),
    );
  }

  const [file] = await db
    .insert(storedFileTable)
    .values({
      workspaceId: input.workspaceId,
      uploadedBy: input.uploadedBy,
      filename: input.filename.slice(0, 200),
      mimeType: input.mimeType,
      size: input.bytes.length,
      storage: bucket ? "s3" : "db",
      objectKey: objectKeyValue,
      data: bucket ? null : input.bytes,
      kind: input.kind,
      folder: input.folder ?? "",
    })
    .returning({
      id: storedFileTable.id,
      filename: storedFileTable.filename,
      mimeType: storedFileTable.mimeType,
      size: storedFileTable.size,
      storage: storedFileTable.storage,
      folder: storedFileTable.folder,
      createdAt: storedFileTable.createdAt,
    });
  if (!file) throw new HTTPException(500, { message: "Failed to store file" });
  return file;
}

// Only these are shown in the browser. Everything else (HTML, SVG, any +xml,
// scripts, unknown types) is served as an opaque download, so an uploaded
// file can never run as a page on Kaneo's origin or the bucket's.
const INLINE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "application/pdf",
  "text/plain",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "video/mp4",
  "video/webm",
]);

function baseType(mimeType: string) {
  return (mimeType.toLowerCase().split(";")[0] ?? "").trim();
}

/** The Content-Type a stored file is served with. */
export function servedType(mimeType: string) {
  const base = baseType(mimeType);
  return INLINE_TYPES.has(base) ? base : "application/octet-stream";
}

export function safeDisposition(mimeType: string, filename: string) {
  // Header values must be printable ASCII; the real name goes in filename*.
  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(filename);
  const inline = INLINE_TYPES.has(baseType(mimeType));
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Headers every served file gets, on top of type and disposition. */
export const FILE_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "sandbox; default-src 'none'",
} as const;

type StoredFile = typeof storedFileTable.$inferSelect;

/**
 * How to hand a stored file to someone: a short-lived bucket URL to redirect
 * to, or the bytes when they live in Postgres.
 */
export async function openBlob(
  file: StoredFile,
): Promise<{ redirect: string } | { bytes: Buffer }> {
  if (file.storage === "s3" && file.objectKey) {
    const bucket = await getBucketConfig(file.workspaceId);
    if (!bucket) {
      throw new HTTPException(410, {
        message: "This file's storage was disconnected",
      });
    }
    const url = await getSignedUrl(
      clientFor(bucket),
      new GetObjectCommand({
        Bucket: bucket.bucket,
        Key: file.objectKey,
        ResponseContentType: servedType(file.mimeType),
        ResponseContentDisposition: safeDisposition(
          file.mimeType,
          file.filename,
        ),
      }),
      { expiresIn: 15 * 60 },
    );
    return { redirect: url };
  }
  if (!file.data) {
    throw new HTTPException(404, { message: "File not found" });
  }
  return { bytes: file.data };
}

/** The bytes themselves, for callers that must proxy (e.g. receipts). */
export async function readBlobBytes(file: StoredFile): Promise<Buffer> {
  if (file.storage === "s3" && file.objectKey) {
    const bucket = await getBucketConfig(file.workspaceId);
    if (!bucket) {
      throw new HTTPException(410, {
        message: "This file's storage was disconnected",
      });
    }
    const response = await clientFor(bucket).send(
      new GetObjectCommand({ Bucket: bucket.bucket, Key: file.objectKey }),
    );
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  if (!file.data) throw new HTTPException(404, { message: "File not found" });
  return file.data;
}

export async function deleteBlob(file: StoredFile) {
  if (file.storage === "s3" && file.objectKey) {
    const bucket = await getBucketConfig(file.workspaceId);
    if (bucket) {
      await clientFor(bucket).send(
        new DeleteObjectCommand({ Bucket: bucket.bucket, Key: file.objectKey }),
      );
    }
  }
  await db.delete(storedFileTable).where(eq(storedFileTable.id, file.id));
}
