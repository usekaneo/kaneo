import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { createRequire } from "node:module";
import { Client, localOrigin, ready, seed } from "./http.mjs";

const [mode, inputOrigin, stateFile] = process.argv.slice(2);
assert.ok(
  ["seed", "verify"].includes(mode) && stateFile,
  "Expected seed|verify ORIGIN STATE_FILE",
);
const origin = localOrigin(inputOrigin);
await ready(origin);
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHAAAAABJRU5ErkJggg==",
  "base64",
);
if (mode === "seed") {
  const require = createRequire(
    new URL("../../apps/api/package.json", import.meta.url),
  );
  const { S3Client, CreateBucketCommand } = require("@aws-sdk/client-s3");
  const storage = new S3Client({
    endpoint: "http://127.0.0.1:59040",
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: "local-test-access",
      secretAccessKey: "local-test-secret-only",
    },
  });
  try {
    await storage.send(new CreateBucketCommand({ Bucket: "kaneo-ci-test" }));
  } catch (error) {
    if (error.name !== "BucketAlreadyOwnedByYou") throw error;
  } finally {
    storage.destroy();
  }
  const { client, account, workspace, project, task } = await seed(
    origin,
    "upgrade",
  );
  const comment = await client.json(`/api/comment/${task.id}`, "POST", {
    content: "Comment retained across upgrades",
  });
  const input = {
    filename: "upgrade.png",
    contentType: "image/png",
    size: bytes.length,
    surface: "description",
  };
  const upload = await client.json(
    `/api/task/image-upload/${task.id}`,
    "PUT",
    input,
  );
  const uploadUrl = new URL(upload.uploadUrl);
  assert.ok(
    ["minio:9000", "127.0.0.1:59040"].includes(uploadUrl.host),
    "Only the disposable MinIO endpoint is allowed",
  );
  // Reach the Compose service through its loopback port while preserving its signed Host header.
  await new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port: 59040,
        path: uploadUrl.pathname + uploadUrl.search,
        method: "PUT",
        headers: {
          ...upload.headers,
          Host: uploadUrl.host,
          "Content-Length": bytes.length,
        },
        timeout: 15_000,
      },
      (response) => {
        response.resume();
        response.on("end", () =>
          response.statusCode === 200
            ? resolve()
            : reject(
                new Error(`Fixture upload failed: ${response.statusCode}`),
              ),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("Upload timed out")));
    req.on("error", reject);
    req.end(bytes);
  });
  const asset = await client.json(
    `/api/task/image-upload/${task.id}/finalize`,
    "POST",
    { ...input, key: upload.key },
  );
  await writeFile(
    stateFile,
    JSON.stringify({
      email: client.email,
      userId: account.user.id,
      workspace,
      project,
      task,
      comment,
      asset,
    }),
    { mode: 0o600 },
  );
  console.log(
    "Previous release seeded with account, membership, project, task, comment and image",
  );
} else {
  const fixture = JSON.parse(await readFile(stateFile, "utf8"));
  const client = new Client(origin);
  await client.signin(fixture.email);
  const workspaces = await client.json("/api/auth/organization/list");
  assert.ok(
    workspaces.some((workspace) => workspace.id === fixture.workspace.id),
  );
  const members = await client.json(
    `/api/workspace/${fixture.workspace.id}/members`,
  );
  assert.ok(
    members.some(
      (member) => member.id === fixture.userId && member.role === "owner",
    ),
  );
  const project = await client.json(`/api/project/${fixture.project.id}`);
  assert.equal(project.name, fixture.project.name);
  const task = await client.json(`/api/task/${fixture.task.id}`);
  for (const field of [
    "title",
    "description",
    "status",
    "priority",
    "number",
    "projectId",
  ])
    assert.equal(
      task[field],
      fixture.task[field],
      `Task ${field} changed during upgrade`,
    );
  const comments = await client.json(`/api/comment/${task.id}`);
  assert.ok(
    comments.some(
      (comment) =>
        comment.id === fixture.comment.id &&
        comment.content === fixture.comment.content,
    ),
  );
  const assetUrl = new URL(fixture.asset.url, origin);
  const image = await client.response(assetUrl.pathname);
  assert.equal(image.status, 200);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes);
  const outsider = new Client(origin);
  await outsider.signup("upgrade-outsider");
  assert.ok(
    [403, 404].includes((await outsider.response(assetUrl.pathname)).status),
    "Private image became public after upgrade",
  );
  await client.json(`/api/task/status/${task.id}`, "PUT", {
    status: "in-progress",
  });
  assert.equal(
    (await client.json(`/api/task/${task.id}`)).status,
    "in-progress",
  );
  console.log(
    "Upgrade preserved credentials, membership, task data, comments and private image bytes; writes still work",
  );
}
