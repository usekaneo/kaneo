import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

test("the original entry point does not load Quackback providers", () => {
  execFileSync(
    process.execPath,
    [
      "-e",
      `
    const assert = require('node:assert/strict');
    const original = require('@kaneo/email');
    assert.equal(typeof original.sendOtpEmail, 'function');
    assert.equal(typeof original.sendRawEmail, 'undefined');
    assert.equal(Object.keys(require.cache).some(path => path.includes('/quills/')), false);
  `,
    ],
    {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        EMAIL_SMTP_HOST: "localhost",
        EMAIL_RESEND_API_KEY: "test-only",
      },
    },
  );
});

test("every public export resolves as JavaScript and has declarations", async () => {
  for (const [subpath, entry] of Object.entries(manifest.exports)) {
    const name = "@kaneo/email" + (subpath === "." ? "" : subpath.slice(1));
    assert.doesNotThrow(() => require(name), name);
    await import(name);
    assert.ok(
      readFileSync(new URL("../" + entry.types, import.meta.url), "utf8")
        .length > 0,
      name,
    );
  }
});

test("the built templates render with their isolated JSX runtime", async () => {
  const { MagicLinkEmail } = require("@kaneo/email/quills/templates");
  const { createElement } = require("react");
  const { render } = require("@react-email/components");
  const html = await render(
    createElement(MagicLinkEmail, {
      signInUrl: "https://example.test/sign-in",
      code: "123456",
    }),
  );
  assert.match(html, /123456/);
  assert.match(html, /https:\/\/example.test\/sign-in/);
});
