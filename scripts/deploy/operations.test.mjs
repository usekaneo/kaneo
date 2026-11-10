import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

test("dependency probe checks migrations, real pub/sub delivery and storage cleanup", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "kaneo-probe-test-"));
  try {
    writeFileSync(path.join(directory, "package.json"), "{}");
    writeFileSync(
      path.join(directory, "preload.cjs"),
      `
      const Module = require('node:module');
      const { EventEmitter } = require('node:events');
      const fs = require('node:fs');
      const original = Module._load;
      const record = (value) => fs.appendFileSync(process.env.CALL_LOG, value+'\\n');
      let subscriber;
      class Redis extends EventEmitter {
        constructor(url) { super(); this.url=url; }
        async connect() { if(process.env.SCENARIO==='redis') throw new Error('SENSITIVE'); }
        async subscribe(channel) { subscriber=this; this.channel=channel; }
        async publish(channel,message) { subscriber.emit('message',channel,process.env.SCENARIO==='pubsub'?'wrong':message); }
        disconnect() { record('disconnect'); }
      }
      const commands = Object.fromEntries(['PutObjectCommand','GetObjectCommand','DeleteObjectCommand'].map(name=>[name,class {constructor(input){this.name=name;this.input=input;}}]));
      Module._load = function(name,...args) {
        if(name==='pg') return {Pool:class {async query(sql){record(sql);return {rows:[{count:process.env.SCENARIO==='migrations'?0:1}]};} async end(){record('end');}}};
        if(name==='ioredis') return Redis;
        if(name==='@aws-sdk/client-s3') return {...commands,S3Client:class {
          async send(command) { record(command.name); if(command.name==='GetObjectCommand') { if(process.env.SCENARIO==='storage') throw new Error('SENSITIVE'); return {Body:{transformToString:async()=> 'kaneo-deployment-probe'}};} }
          destroy(){record('destroy');}
        }};
        return original.call(this,name,...args);
      };
    `,
    );
    for (const scenario of [
      "success",
      "migrations",
      "redis",
      "pubsub",
      "storage",
    ]) {
      const log = path.join(directory, `${scenario}.log`);
      const result = spawnSync(
        process.execPath,
        [
          "--require",
          path.join(directory, "preload.cjs"),
          path.join(import.meta.dirname, "probe.mjs"),
        ],
        {
          cwd: directory,
          encoding: "utf8",
          env: { ...process.env, SCENARIO: scenario, CALL_LOG: log },
          timeout: 5000,
        },
      );
      assert.equal(
        result.status,
        scenario === "success" ? 0 : 1,
        `${scenario}: ${result.stderr}`,
      );
      assert.doesNotMatch(result.stdout + result.stderr, /SENSITIVE/);
      const calls = readFileSync(log, "utf8");
      assert.match(calls, /drizzle\.__drizzle_migrations/);
      assert.match(calls, /end/);
      if (scenario === "success" || scenario === "storage")
        assert.match(calls, /DeleteObjectCommand/);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("R2 setup saves private configuration, preserves stable keys and refuses old-provider credentials", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "kaneo-setup-test-"));
  try {
    mkdirSync(path.join(directory, "scripts/deploy"), { recursive: true });
    cpSync(
      path.join(import.meta.dirname, "setup.mjs"),
      path.join(directory, "scripts/deploy/setup.mjs"),
    );
    const base = {
      ...process.env,
      AZURE_SUBSCRIPTION_ID: "88557392-91d3-491f-ab97-234782d07f12",
      S3_ENDPOINT:
        "https://00000000000000000000000000000000.r2.cloudflarestorage.com",
      S3_BUCKET: "kaneo-uploads",
      S3_ACCESS_KEY_ID: "runtime-key",
      S3_SECRET_ACCESS_KEY: "runtime-secret",
    };
    const run = (extra = {}) =>
      spawnSync(
        process.execPath,
        [path.join(directory, "scripts/deploy/setup.mjs")],
        { encoding: "utf8", env: { ...base, ...extra }, timeout: 5000 },
      );
    const file = path.join(directory, ".cache/deploy/deploy.env");
    assert.equal(run({ S3_SECRET_ACCESS_KEY: "" }).status, 1);
    assert.equal(existsSync(file), false);
    const success = run();
    assert.equal(success.status, 0, success.stderr);
    assert.equal(statSync(file).mode & 0o777, 0o600);
    const saved = readFileSync(file, "utf8");
    assert.match(saved, /AUTH_SECRET="[a-f0-9]{64}"/);
    assert.match(saved, /S3_REGION="auto"/);
    assert.doesNotMatch(success.stdout + success.stderr, /runtime-secret/);
    assert.equal(run({ AUTH_SECRET: "do-not-rotate-existing-auth" }).status, 0);
    assert.equal(readFileSync(file, "utf8"), saved);
    assert.equal(
      run({
        S3_ENDPOINT:
          "https://11111111111111111111111111111111.r2.cloudflarestorage.com",
        S3_ACCESS_KEY_ID: "",
        S3_SECRET_ACCESS_KEY: "",
      }).status,
      1,
    );
    assert.equal(readFileSync(file, "utf8"), saved);
    assert.equal(
      run({ S3_ENDPOINT: "https://nyc3.digitaloceanspaces.com" }).status,
      1,
    );
    assert.equal(readFileSync(file, "utf8"), saved);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
