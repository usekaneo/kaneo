/**
 * Redaction tests for the shared logger.
 *
 * These assert on real emitted output rather than on `REDACT_PATHS`, because
 * the failure mode being guarded against is a path that looks right in the
 * list but never matches: Pino compares path segments exactly, so an entry
 * that is one nesting level or one naming convention off is silently inert.
 * Every case below therefore checks the serialized line for the raw value.
 */
import { describe, it, expect } from "vite-plus/test";
import { createLogger } from "../logger";

/** Collect emitted lines, both raw and parsed. */
function capture() {
  const lines: string[] = [];
  const destination = { write: (s: string) => void lines.push(s) };
  return {
    destination,
    raw: () => lines.join(""),
    last: () => JSON.parse(lines[lines.length - 1]),
  };
}

describe("logger redaction", () => {
  it("drops a credential nested inside a wrapper field", () => {
    const sink = capture();
    const log = createLogger({ destination: sink.destination, level: "error" });

    log.error(
      { input: { OPENAI_API_KEY: "sk-x", values: { clientSecret: "y" } } },
      "x",
    );

    expect(sink.raw()).not.toContain("sk-x");
    expect(sink.raw()).not.toContain('"y"');
    expect(sink.last().input).toBeUndefined();
    expect(sink.last().msg).toBe("x");
  });

  it("drops every wrapper field name a caller might reach for", () => {
    const sink = capture();
    const log = createLogger({ destination: sink.destination, level: "error" });

    log.error(
      {
        values: "v-leak",
        fields: "f-leak",
        draft: "d-leak",
        input: "i-leak",
        payload: "p-leak",
        sealedPayload: "s-leak",
        outer: {
          values: "nv-leak",
          fields: "nf-leak",
          draft: "nd-leak",
          input: "ni-leak",
          payload: "np-leak",
          sealedPayload: "ns-leak",
        },
        provider_id: "keep_me",
      },
      "wrappers",
    );

    expect(sink.raw()).not.toContain("leak");
    expect(sink.last().provider_id).toBe("keep_me");
  });

  it("drops OAuth, webhook-signing and bot credential field names", () => {
    const sink = capture();
    const log = createLogger({ destination: sink.destination, level: "error" });

    log.error(
      {
        clientSecret: "cs-leak",
        signingSecret: "ss-leak",
        botToken: "bt-leak",
        nested: {
          clientSecret: "ncs-leak",
          signingSecret: "nss-leak",
          botToken: "nbt-leak",
        },
        clientId: "keep_client_id",
      },
      "oauth",
    );

    expect(sink.raw()).not.toContain("leak");
    // The public half of an OAuth pair is not a secret and stays legible.
    expect(sink.last().clientId).toBe("keep_client_id");
  });

  it("drops credential keys that are not valid identifiers", () => {
    const sink = capture();
    const log = createLogger({ destination: sink.destination, level: "error" });

    log.error(
      {
        "access-key-id": "ak-leak",
        "secret-access-key": "sak-leak",
        ".dockerconfigjson": "dcj-leak",
        nested: {
          "access-key-id": "nak-leak",
          "secret-access-key": "nsak-leak",
          ".dockerconfigjson": "ndcj-leak",
        },
        bucket: "keep_bucket",
      },
      "storage",
    );

    expect(sink.raw()).not.toContain("leak");
    expect(sink.last().bucket).toBe("keep_bucket");
  });

  it("still redacts the original secret and PII paths", () => {
    const sink = capture();
    const log = createLogger({ destination: sink.destination, level: "error" });

    log.error(
      {
        password: "pw-leak",
        token: "tok-leak",
        email: "leak@example.com",
        "set-cookie": "sid=leak",
        req: { headers: { authorization: "Bearer leak", host: "localhost" } },
        post_id: "keep_me",
      },
      "regression",
    );

    expect(sink.raw()).not.toContain("leak");
    // `headers` is a sensitive container, so the whole subtree is dropped.
    expect(sink.last().req.headers).toBeUndefined();
    expect(sink.last().post_id).toBe("keep_me");
  });

  it("constructs and emits with the full path list", () => {
    const sink = capture();
    const log = createLogger({ destination: sink.destination, level: "info" });

    // A path that shadows another can throw at construction in some Pino
    // versions, which would take down every service that builds a logger at
    // import time. Proving a line comes out proves the list is accepted.
    expect(() => log.info({ post_id: "post_1" }, "boot")).not.toThrow();
    expect(sink.last().msg).toBe("boot");
  });
});
