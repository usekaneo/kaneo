import { Readable } from "node:stream";
import {
  BlobClient,
  BlobServiceClient,
  BlockBlobClient,
  ContainerClient,
  RestError,
  type ServiceGetUserDelegationKeyResponse,
} from "@azure/storage-blob";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { readAzureStorageConfig } from "./azure";
import {
  assertStorageConfigured,
  copyTaskAssetObject,
  createProjectBackgroundUploadUrl,
  createTaskImageUploadUrl,
  deleteS3Object,
  getPrivateObject,
  headStorageBucket,
  InvalidUploadedAssetError,
  isStorageConfigured,
  verifyTaskAssetUpload,
} from "./s3";
import { describeStorageError } from "./describe-storage-error";

const now = new Date("2026-01-01T12:00:00Z");
const sdkResponse = {
  _response: {} as ServiceGetUserDelegationKeyResponse["_response"],
};
const context = {
  workspaceId: "workspace-1",
  projectId: "project-1",
  taskId: "task-1",
  surface: "comment" as const,
  filename: "report.pdf",
  contentType: "application/pdf",
  size: 4,
};

describe("Azure Blob storage", () => {
  beforeEach(() => {
    vi.stubEnv("STORAGE_BACKEND", "azure");
    vi.stubEnv(
      "AZURE_STORAGE_ACCOUNT_URL",
      "https://kaneotest.blob.core.windows.net",
    );
    vi.stubEnv("AZURE_STORAGE_CONTAINER", "uploads");
    vi.stubEnv("AZURE_STORAGE_KEY_PREFIX", "stage");
    vi.stubEnv("S3_MAX_IMAGE_UPLOAD_BYTES", "10");
    vi.stubEnv("S3_PRESIGN_TTL_SECONDS", "300");
    vi.stubEnv("S3_ENDPOINT", "");
    vi.stubEnv("S3_BUCKET", "");
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());
    vi.spyOn(
      BlobServiceClient.prototype,
      "getUserDelegationKey",
    ).mockResolvedValue({
      ...sdkResponse,
      signedObjectId: "00000000-0000-0000-0000-000000000001",
      signedTenantId: "00000000-0000-0000-0000-000000000002",
      signedStartsOn: new Date("2026-01-01T11:00:00Z"),
      signedExpiresOn: new Date("2026-01-01T13:00:00Z"),
      signedService: "b",
      signedVersion: "2025-11-05",
      value: Buffer.alloc(32, 1).toString("base64"),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("uses Azure without requiring S3 credentials", () => {
    expect(assertStorageConfigured()).toMatchObject({
      backend: "azure",
      container: "uploads",
    });
    expect(isStorageConfigured()).toBe(true);
  });

  it.each([
    "http://kaneotest.blob.core.windows.net",
    "https://user:secret@kaneotest.blob.core.windows.net",
    "https://kaneotest.blob.core.windows.net?sig=secret",
    "https://kaneotest.blob.core.windows.net/container",
  ])("rejects an unsafe account URL: %s", (accountUrl) => {
    vi.stubEnv("AZURE_STORAGE_ACCOUNT_URL", accountUrl);
    expect(() => readAzureStorageConfig()).toThrow();
    expect(isStorageConfigured()).toBe(false);
  });

  it.each(["", "UPPERCASE", "../other", "double--dash", "ab"])(
    "rejects invalid container name: %s",
    (container) => {
      vi.stubEnv("AZURE_STORAGE_CONTAINER", container);
      expect(() => readAzureStorageConfig()).toThrow();
    },
  );

  it("rejects unknown backends instead of falling back to another store", () => {
    vi.stubEnv("STORAGE_BACKEND", "azuer");
    expect(() => assertStorageConfigured()).toThrow();
  });

  it("signs HTTPS create-only uploads for the exact object and expiry", async () => {
    const upload = await createTaskImageUploadUrl(context);
    const url = new URL(upload.uploadUrl);
    expect(upload.key).toMatch(
      /^stage\/workspace\/workspace-1\/project\/project-1\/task\/task-1\/comments\/report-/,
    );
    expect(url.pathname).toBe(`/uploads/${upload.key}`);
    expect(url.searchParams.get("sp")).toBe("c");
    expect(url.searchParams.get("spr")).toBe("https");
    expect(url.searchParams.get("sr")).toBe("b");
    expect(url.searchParams.get("se")).toBe("2026-01-01T12:05:00Z");
    expect(url.searchParams.get("sig")).toBeTruthy();
    expect(upload.headers).toEqual({
      "Content-Type": "application/pdf",
      "x-ms-blob-type": "BlockBlob",
    });
  });

  it("signs background uploads without changing the frontend upload contract", async () => {
    const upload = await createProjectBackgroundUploadUrl({
      ...context,
      contentType: "image/png",
    });
    expect(upload.key).toBe(
      `stage/workspace/workspace-1/project/project-1/backgrounds/background-${upload.version}`,
    );
    expect(new URL(upload.uploadUrl).searchParams.get("sp")).toBe("c");
    expect(upload.headers["x-ms-blob-type"]).toBe("BlockBlob");
  });

  it("checks uploaded bytes and content type before publication", async () => {
    vi.spyOn(BlobClient.prototype, "getProperties").mockResolvedValue({
      ...sdkResponse,
      contentLength: 4,
      contentType: "application/pdf",
    });
    await expect(verifyTaskAssetUpload("file", context)).resolves.toEqual({
      size: 4,
      contentType: "application/pdf",
    });
    await expect(
      verifyTaskAssetUpload("file", {
        size: 3,
        contentType: "application/pdf",
      }),
    ).rejects.toBeInstanceOf(InvalidUploadedAssetError);
    await expect(
      verifyTaskAssetUpload("file", { size: 4, contentType: "text/plain" }),
    ).rejects.toBeInstanceOf(InvalidUploadedAssetError);
  });

  it("removes oversized uploads and refuses to finalize them", async () => {
    vi.spyOn(BlobClient.prototype, "getProperties").mockResolvedValue({
      ...sdkResponse,
      contentLength: 11,
      contentType: "application/pdf",
    });
    const remove = vi
      .spyOn(BlobClient.prototype, "deleteIfExists")
      .mockResolvedValue({ ...sdkResponse, succeeded: true });
    await expect(verifyTaskAssetUpload("file", context)).rejects.toThrow(
      "exceeds the maximum upload size",
    );
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith({
      abortSignal: expect.any(AbortSignal),
    });
  });

  it("maps missing blobs to the existing upload validation error", async () => {
    vi.spyOn(BlobClient.prototype, "getProperties").mockRejectedValue(
      new RestError("Not found", { statusCode: 404, code: "BlobNotFound" }),
    );
    await expect(verifyTaskAssetUpload("file", context)).rejects.toThrow(
      "Uploaded object was not found",
    );
  });

  it("streams private content without returning a signed download URL", async () => {
    vi.spyOn(BlobClient.prototype, "download").mockResolvedValue({
      ...sdkResponse,
      readableStreamBody: Readable.from([Buffer.from("file")]),
      contentLength: 4,
      contentType: "application/pdf",
      etag: "etag-1",
    });
    const object = await getPrivateObject("file");
    expect(object).toMatchObject({
      contentLength: 4,
      contentType: "application/pdf",
      etag: "etag-1",
    });
    expect(await new Response(object.body as ReadableStream).text()).toBe(
      "file",
    );
    expect(object).not.toHaveProperty("url");
  });

  it("copies synchronously to a new object and never overwrites a destination", async () => {
    const copy = vi
      .spyOn(BlockBlobClient.prototype, "syncUploadFromURL")
      .mockResolvedValue({ ...sdkResponse });
    const key = await copyTaskAssetObject({
      sourceKey: "source/file.pdf",
      destination: context,
    });
    expect(key).toMatch(/^stage\/workspace\//);
    expect(copy).toHaveBeenCalledOnce();
    const [source, options] = copy.mock.calls[0]!;
    expect(new URL(source).pathname).toBe("/uploads/source/file.pdf");
    expect(new URL(source).searchParams.get("sp")).toBe("r");
    expect(options?.conditions).toEqual({ ifNoneMatch: "*" });
  });

  it("deletes idempotently and probes the configured container", async () => {
    const remove = vi
      .spyOn(BlobClient.prototype, "deleteIfExists")
      .mockResolvedValue({ ...sdkResponse, succeeded: false });
    const probe = vi
      .spyOn(ContainerClient.prototype, "getProperties")
      .mockResolvedValue({ ...sdkResponse });
    const signal = AbortSignal.timeout(1000);
    await deleteS3Object("missing");
    await headStorageBucket(signal);
    expect(remove).toHaveBeenCalledOnce();
    expect(probe).toHaveBeenCalledWith({ abortSignal: signal });
  });

  it("does not leak signed URLs or headers when Azure rejects a request", async () => {
    vi.spyOn(
      BlobServiceClient.prototype,
      "getUserDelegationKey",
    ).mockRejectedValue(
      new RestError("secret URL ?sig=private", {
        statusCode: 403,
        code: "AuthorizationPermissionMismatch",
      }),
    );
    const error = await createTaskImageUploadUrl(context).catch(
      (error: unknown) => error,
    );
    expect(describeStorageError(error)).toEqual({
      name: "AzureBlobStorageError",
      status: 403,
      code: "AuthorizationPermissionMismatch",
    });
    expect(String(error)).not.toContain("private");
    expect(JSON.stringify(error)).not.toContain("private");
  });
});
