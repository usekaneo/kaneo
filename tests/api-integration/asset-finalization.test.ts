import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "../../apps/api/node_modules/@aws-sdk/client-s3";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function fixture() {
  const member = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ title: "Upload task", projectId: project.id })
    .returning();
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const body = {
    filename: "test.png",
    contentType: "image/png",
    size: 12,
    surface: "description",
  };
  const response = await app.request(`/api/task/image-upload/${task.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
  const upload = (await response.json()) as { key: string; uploadUrl: string };
  const signedHeaders = new URL(upload.uploadUrl).searchParams
    .get("X-Amz-SignedHeaders")
    ?.split(";");
  expect(signedHeaders).toEqual(
    expect.arrayContaining(["content-length", "content-type"]),
  );
  return {
    key: upload.key,
    finalize(overrides: Record<string, unknown> = {}) {
      return app.request(`/api/task/image-upload/${task.id}/finalize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, key: upload.key, ...overrides }),
      });
    },
  };
}

describe("asset finalization proof", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.stubEnv("S3_ENDPOINT", "https://storage.example.test");
    vi.stubEnv("S3_BUCKET", "local-test-bucket");
    vi.stubEnv("S3_ACCESS_KEY_ID", "local-test-key");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "local-test-secret");
    vi.stubEnv("S3_KEY_PREFIX", "");
    vi.stubEnv("S3_MAX_IMAGE_UPLOAD_BYTES", "64");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("does not create records for nonexistent objects", async () => {
    const send = vi.spyOn(S3Client.prototype, "send").mockRejectedValue(
      Object.assign(new Error("provider-private-detail"), {
        name: "NotFound",
      }),
    );
    const { finalize } = await fixture();
    const response = await finalize();
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Uploaded object was not found.");
    expect(await db.select().from(schema.assetTable)).toHaveLength(0);
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
  });

  it.each([
    { ContentLength: 13, ContentType: "image/png" },
    { ContentLength: 12, ContentType: "text/html" },
    { ContentLength: 0, ContentType: "image/png" },
    { ContentType: "image/png" },
  ])(
    "rejects inconsistent metadata %j without deleting in-limit objects",
    async (metadata) => {
      const send = vi
        .spyOn(S3Client.prototype, "send")
        .mockResolvedValue(metadata);
      const { finalize } = await fixture();
      const response = await finalize();
      expect(response.status).toBe(400);
      expect(await db.select().from(schema.assetTable)).toHaveLength(0);
      expect(send).toHaveBeenCalledOnce();
    },
  );

  it("removes an oversized object left by an old upload URL without creating an asset", async () => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValueOnce({ ContentLength: 65, ContentType: "image/png" })
      .mockResolvedValueOnce({});
    const { key, finalize } = await fixture();
    const response = await finalize();
    expect(response.status).toBe(400);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toBeInstanceOf(DeleteObjectCommand);
    expect(send.mock.calls[1][0].input).toMatchObject({
      Key: key,
      Bucket: "local-test-bucket",
    });
    expect(await db.select().from(schema.assetTable)).toHaveLength(0);
  });

  it.each(["head", "delete"])(
    "fails closed without provider details when %s fails",
    async (stage) => {
      const send = vi.spyOn(S3Client.prototype, "send");
      if (stage === "delete")
        send.mockResolvedValueOnce({
          ContentLength: 65,
          ContentType: "image/png",
        });
      send.mockRejectedValueOnce(
        new Error("https://storage.example.test/?credential=secret"),
      );
      const { finalize } = await fixture();
      const response = await finalize();
      expect(response.status).toBe(503);
      expect(await response.text()).toBe("Unable to verify uploaded object.");
      expect(await db.select().from(schema.assetTable)).toHaveLength(0);
    },
  );

  it("checks key ownership before contacting storage", async () => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockRejectedValue(new Error("must not run"));
    const { finalize } = await fixture();
    expect(
      (
        await finalize({
          key: "workspace/foreign/project/foreign/task/foreign/descriptions/x.png",
        })
      ).status,
    ).toBe(400);
    expect(send).not.toHaveBeenCalled();
    expect(await db.select().from(schema.assetTable)).toHaveLength(0);
  });

  it("persists verified metadata and preserves an existing record on failed refinalization", async () => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({ ContentLength: 12, ContentType: "image/png" });
    const { key, finalize } = await fixture();
    const first = await finalize();
    expect(first.status).toBe(200);
    const second = await finalize();
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    const [asset] = await db.select().from(schema.assetTable);
    expect(asset).toMatchObject({
      objectKey: key,
      size: 12,
      mimeType: "image/png",
      kind: "image",
    });
    send.mockRejectedValueOnce(
      Object.assign(new Error("not found"), { name: "NotFound" }),
    );
    expect((await finalize({ filename: "changed.png" })).status).toBe(400);
    expect(await db.select().from(schema.assetTable)).toEqual([asset]);
  });
});
