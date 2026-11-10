// Executed in the deployed image so probes use the same network and dependencies.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(`${process.cwd()}/package.json`);
const { Pool } = require("pg");
const Redis = require("ioredis");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const timer = setTimeout(() => {
  console.error("Dependency verification timed out");
  process.exit(1);
}, 60000);
let stage = "PostgreSQL";
let pool, publisher, subscriber, s3;
try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
  });
  const result = await pool.query(
    "select count(*)::int as count from drizzle.__drizzle_migrations",
  );
  assert.ok(result.rows[0].count > 0, "No applied migrations");
  await pool.query('select 1 from "user" limit 0');
  console.log("PostgreSQL and migrations: passed");

  stage = "Redis";
  const options = {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
    connectTimeout: 10000,
  };
  publisher = new Redis(process.env.REDIS_URL, options);
  subscriber = new Redis(process.env.REDIS_URL, options);
  publisher.on("error", () => {});
  subscriber.on("error", () => {});
  await Promise.all([publisher.connect(), subscriber.connect()]);
  const channel = `kaneo:deployment:${randomUUID()}`;
  const received = new Promise((resolve) =>
    subscriber.once("message", (name, message) => resolve([name, message])),
  );
  await subscriber.subscribe(channel);
  await publisher.publish(channel, "probe");
  assert.deepEqual(await received, [channel, "probe"]);
  console.log("Redis TLS and publish/subscribe: passed");

  stage = "Object storage";
  s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
  const object = {
    Bucket: process.env.S3_BUCKET,
    Key: `${process.env.S3_KEY_PREFIX || ""}deployment-probes/${randomUUID()}`,
  };
  try {
    await s3.send(
      new PutObjectCommand({ ...object, Body: "kaneo-deployment-probe" }),
    );
    const response = await s3.send(new GetObjectCommand(object));
    assert.equal(
      await response.Body.transformToString(),
      "kaneo-deployment-probe",
    );
  } finally {
    await s3.send(new DeleteObjectCommand(object));
  }
  console.log("Private object storage write/read/delete: passed");
} catch {
  // Provider errors can include credential-bearing URLs; report only the stage.
  console.error(`${stage} verification failed`);
  process.exitCode = 1;
} finally {
  publisher?.disconnect();
  subscriber?.disconnect();
  s3?.destroy();
  await pool?.end();
  clearTimeout(timer);
}
