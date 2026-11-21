import { createHmac } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { verifyTangledSignature } from "./verify-signature";

const secret = "webhook-secret";
const body = new TextEncoder().encode('{"event":"push"}');

function sign(payload: Uint8Array, key = secret): string {
  return `sha256=${createHmac("sha256", key).update(payload).digest("hex")}`;
}

describe("verifyTangledSignature", () => {
  it("accepts a valid HMAC over the exact raw body", () => {
    expect(verifyTangledSignature(body, secret, sign(body))).toBe(true);
  });

  it("accepts uppercase hexadecimal digest characters", () => {
    expect(verifyTangledSignature(body, secret, sign(body).toUpperCase())).toBe(
      true,
    );
  });

  it("rejects a signature for a modified body", () => {
    const modifiedBody = new TextEncoder().encode('{"event":"pull"}');

    expect(verifyTangledSignature(modifiedBody, secret, sign(body))).toBe(
      false,
    );
  });

  it("preserves byte sensitivity rather than normalizing the body", () => {
    const bodyWithWhitespace = new TextEncoder().encode('{ "event":"push"}');

    expect(verifyTangledSignature(bodyWithWhitespace, secret, sign(body))).toBe(
      false,
    );
  });

  it.each([
    undefined,
    "",
    "sha1=abcd",
    "sha256=xyz",
    "sha256=1234",
    `sha256=${"a".repeat(63)}`,
    `sha256=${"a".repeat(65)}`,
  ])("rejects malformed or missing signature %s", (signature) => {
    expect(verifyTangledSignature(body, secret, signature)).toBe(false);
  });

  it("rejects an empty secret", () => {
    expect(verifyTangledSignature(body, "", sign(body, ""))).toBe(false);
  });
});
