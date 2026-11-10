#!/usr/bin/env node
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

// The resulting file is also the GitHub environment secret. Keep existing keys stable.
const directory = path.resolve(import.meta.dirname, "../../.cache/deploy");
const file = path.join(directory, "deploy.env");
const saved = existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
const value = (key) => process.env[key] || saved[key];
const subscription = value("AZURE_SUBSCRIPTION_ID");
assert.match(
  subscription || "",
  /^[a-f0-9-]{36}$/i,
  "Set AZURE_SUBSCRIPTION_ID first",
);
const name = value("DO_APP_NAME") || "kaneo-production";
assert.match(name, /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/);
let endpoint;
try {
  endpoint = new URL(
    value("S3_ENDPOINT") ||
      `https://${value("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  );
} catch {
  throw new Error("Set a valid R2 S3 endpoint");
}
assert.equal(endpoint.protocol, "https:", "R2 must use HTTPS");
assert.match(
  endpoint.hostname,
  /^[a-f0-9]{32}(?:\.(?:eu|us|fedramp))?\.r2\.cloudflarestorage\.com$/,
  "Set the R2 S3 endpoint",
);
assert.ok(
  !endpoint.username &&
    !endpoint.password &&
    endpoint.pathname === "/" &&
    !endpoint.search &&
    !endpoint.hash,
  "Use an R2 account endpoint without credentials or a bucket path",
);
const switchingStorage =
  saved.S3_ENDPOINT && saved.S3_ENDPOINT !== endpoint.origin;
const storageValue = (key) =>
  process.env[key] || (!switchingStorage && saved[key]);
const env = {
  ...saved,
  AZURE_SUBSCRIPTION_ID: subscription,
  DO_APP_NAME: name,
  AUTH_SECRET:
    saved.AUTH_SECRET ||
    value("AUTH_SECRET") ||
    randomBytes(32).toString("hex"),
  NOTIFICATION_SECRET_ENCRYPTION_KEY:
    saved.NOTIFICATION_SECRET_ENCRYPTION_KEY ||
    value("NOTIFICATION_SECRET_ENCRYPTION_KEY") ||
    randomBytes(32).toString("hex"),
  AZURE_POSTGRES_PASSWORD:
    saved.AZURE_POSTGRES_PASSWORD ||
    value("AZURE_POSTGRES_PASSWORD") ||
    randomBytes(32).toString("hex"),
  S3_ENDPOINT: endpoint.origin,
  S3_REGION: "auto",
  S3_BUCKET: storageValue("S3_BUCKET"),
  S3_ACCESS_KEY_ID: storageValue("S3_ACCESS_KEY_ID"),
  S3_SECRET_ACCESS_KEY: storageValue("S3_SECRET_ACCESS_KEY"),
};
assert.ok(
  Object.values(env).every(
    (entry) =>
      typeof entry === "string" && entry.length && !/[\r\n]/.test(entry),
  ),
  "Set S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY for your private R2 bucket",
);
mkdirSync(directory, { recursive: true, mode: 0o700 });
const temporary = `${file}.tmp`;
const encoded =
  Object.entries(env)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${key}=${JSON.stringify(entry)}`)
    .join("\n") + "\n";
assert.ok(
  Object.entries(env).every(([key, entry]) => parseEnv(encoded)[key] === entry),
  "A configuration value cannot be represented safely in an environment file",
);
writeFileSync(temporary, encoded, { mode: 0o600, flag: "wx" });
renameSync(temporary, file);
console.log(
  "R2 configuration saved to .cache/deploy/deploy.env (mode 0600); existing authentication, encryption and database keys were preserved.",
);
