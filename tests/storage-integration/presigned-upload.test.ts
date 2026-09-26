import { request } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "../../apps/api/node_modules/@aws-sdk/client-s3";
import {
  copyTaskAssetObject,
  createTaskImageUploadUrl,
  deleteS3Object,
  verifyTaskAssetUpload,
} from "../../apps/api/src/storage/s3";

vi.mock("dotenv-mono", () => ({ config: () => {} }));

// biome-ignore lint/suspicious/noUndeclaredEnvVars: This opt-in suite runs directly in Vitest, outside Turbo's task cache.
const endpoint = process.env.KANEO_STORAGE_TEST_ENDPOINT;
if (
  !endpoint ||
  new URL(endpoint).hostname !== "127.0.0.1" ||
  new URL(endpoint).protocol !== "http:"
) {
  throw new Error(
    "Set KANEO_STORAGE_TEST_ENDPOINT to the disposable loopback S3 service (http://127.0.0.1:PORT). Real storage endpoints are not allowed.",
  );
}
const bucket = `kaneo-security-${Date.now()}-test`;
const client = new S3Client({
  endpoint,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: "local-test-access",
    secretAccessKey: "local-test-secret-only",
  },
});

beforeAll(async () => {
  vi.stubEnv("S3_ENDPOINT", endpoint);
  vi.stubEnv("S3_BUCKET", bucket);
  vi.stubEnv("S3_ACCESS_KEY_ID", "local-test-access");
  vi.stubEnv("S3_SECRET_ACCESS_KEY", "local-test-secret-only");
  vi.stubEnv("S3_REGION", "us-east-1");
  vi.stubEnv("S3_FORCE_PATH_STYLE", "true");
  vi.stubEnv("S3_KEY_PREFIX", "");
  vi.stubEnv("S3_MAX_IMAGE_UPLOAD_BYTES", "64");
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
});
afterAll(async () => {
  try {
    const objects = await client.send(
      new ListObjectsV2Command({ Bucket: bucket }),
    );
    for (const object of objects.Contents ?? [])
      if (object.Key) await deleteS3Object(object.Key);
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  } finally {
    client.destroy();
    vi.unstubAllEnvs();
  }
});

function presign(size = 12) {
  return createTaskImageUploadUrl({
    workspaceId: "local",
    projectId: "local",
    taskId: "local",
    surface: "description",
    filename: "test.png",
    contentType: "image/png",
    size,
  });
}
function head(key: string) {
  return client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
}

describe("presigned uploads against real local S3 storage", () => {
  it("copies an attachment with reserved characters and survives source deletion", async () => {
    const sourceKey = "source/report #1%.png";
    const body = Buffer.from("independent attachment");
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: sourceKey,
        Body: body,
        ContentType: "image/png",
      }),
    );
    const copiedKey = await copyTaskAssetObject({
      sourceKey,
      destination: {
        workspaceId: "local",
        projectId: "local",
        taskId: "duplicate",
        surface: "description",
        filename: "report.png",
        contentType: "image/png",
      },
    });
    expect(copiedKey).toContain("/task/duplicate/");
    await deleteS3Object(sourceKey);
    const copied = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: copiedKey }),
    );
    expect(copied.ContentType).toBe("image/png");
    expect(await copied.Body?.transformToByteArray()).toEqual(
      new Uint8Array(body),
    );
  });

  it("accepts an exact-size File upload and verifies stored metadata", async () => {
    const upload = await presign(64);
    const response = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: upload.headers,
      body: new File([new Uint8Array(64)], "test.png", { type: "image/png" }),
    });
    expect(response.status).toBe(200);
    expect(
      await verifyTaskAssetUpload(upload.key, {
        size: 64,
        contentType: "image/png",
      }),
    ).toEqual({ size: 64, contentType: "image/png" });
  });
  it.each([1, 13, 65, 4096])(
    "rejects a body of %i bytes signed for 12 bytes without storing it",
    async (size) => {
      const upload = await presign();
      const response = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: upload.headers,
        body: new Uint8Array(size),
      });
      expect(response.status).toBe(403);
      await response.body?.cancel();
      await expect(head(upload.key)).rejects.toMatchObject({
        $metadata: { httpStatusCode: 404 },
      });
    },
  );
  it("rejects a changed Content-Type without storing the object", async () => {
    const upload = await presign();
    const response = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/html" },
      body: new Uint8Array(12),
    });
    expect(response.status).toBe(403);
    await response.body?.cancel();
    await expect(head(upload.key)).rejects.toMatchObject({
      $metadata: { httpStatusCode: 404 },
    });
  });
  it("rejects unsigned chunked transfer without Content-Length", async () => {
    const upload = await presign();
    const status = await new Promise<number>((resolve, reject) => {
      const req = request(
        upload.uploadUrl,
        {
          method: "PUT",
          headers: { ...upload.headers, "transfer-encoding": "chunked" },
        },
        (response) => {
          response.resume();
          response.on("end", () => resolve(response.statusCode ?? 0));
        },
      );
      req.on("error", reject);
      req.end(Buffer.alloc(4096));
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
    await expect(head(upload.key)).rejects.toMatchObject({
      $metadata: { httpStatusCode: 404 },
    });
  });
  it("rejects missing objects and removes old oversized objects during verification", async () => {
    const { key } = await presign();
    await expect(
      verifyTaskAssetUpload(key, { size: 12, contentType: "image/png" }),
    ).rejects.toThrow("Uploaded object was not found");
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.alloc(65),
        ContentType: "image/png",
      }),
    );
    await expect(
      verifyTaskAssetUpload(key, { size: 12, contentType: "image/png" }),
    ).rejects.toThrow("exceeds the maximum");
    await expect(head(key)).rejects.toMatchObject({
      $metadata: { httpStatusCode: 404 },
    });
  });
});
