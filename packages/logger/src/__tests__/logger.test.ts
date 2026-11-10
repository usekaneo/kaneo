import { describe, expect, it } from "vite-plus/test";
import type { DestinationStream } from "pino";

import { runWithLogContext } from "../context";
import { createLogger } from "../logger";

type LogRecord = Record<string, unknown>;

function captureLogger() {
  const records: LogRecord[] = [];

  const destination: DestinationStream = {
    write(line: string) {
      records.push(JSON.parse(line) as LogRecord);
    },
  };

  const logger = createLogger({
    level: "trace",
    base: { service_name: "quackback-test" },
    destination,
  });

  return { logger, records };
}

describe("createLogger", () => {
  it("emits structured JSON with string levels", () => {
    const { logger, records } = captureLogger();

    logger.info({ post_id: "post_1" }, "Published");

    expect(records).toHaveLength(1);

    expect(records[0]).toMatchObject({
      level: "info",
      service_name: "quackback-test",
      post_id: "post_1",
      msg: "Published",
    });

    expect(records[0].time).toEqual(expect.any(Number));
  });

  it("automatically adds ambient context", () => {
    const { logger, records } = captureLogger();

    runWithLogContext(
      {
        request_id: "req_123",
        workspace_key: "workspace_1",
        fields: {
          operation: "publish",
        },
      },
      () => {
        logger.info("Publishing");
      },
    );

    expect(records[0]).toMatchObject({
      request_id: "req_123",
      workspace_key: "workspace_1",
      operation: "publish",
    });

    expect(records[0]).not.toHaveProperty("fields");
  });

  it("does not allow spoofed correlation metadata", () => {
    const { logger, records } = captureLogger();

    runWithLogContext({ request_id: "real_request" }, () => {
      logger.info(
        {
          request_id: "spoofed_request",
          service_name: "spoofed_service",
          workspace_key: "spoofed_workspace",
          trace_id: "spoofed_trace",
        },
        "Event",
      );
    });

    expect(records[0].request_id).toBe("real_request");
    expect(records[0].service_name).toBe("quackback-test");
    expect(records[0]).not.toHaveProperty("workspace_key");
    expect(records[0]).not.toHaveProperty("trace_id");
  });

  it("removes known secrets and raw payloads", () => {
    const { logger, records } = captureLogger();

    logger.info(
      {
        post_id: "post_123",
        token: "sensitive-token",
        clientSecret: "sensitive-secret",
        user: {
          email: "private@example.com",
        },
        request: {
          headers: {
            authorization: "Bearer sensitive-token",
          },
        },
        input: {
          arbitraryCredential: "another-secret",
        },
      },
      "Request received",
    );

    const output = JSON.stringify(records[0]);

    expect(records[0].post_id).toBe("post_123");
    expect(output).not.toContain("sensitive-token");
    expect(output).not.toContain("sensitive-secret");
    expect(output).not.toContain("private@example.com");
    expect(output).not.toContain("another-secret");
  });

  it("rejects invalid static bindings", () => {
    expect(() =>
      createLogger({
        base: {
          workspace_key: "not-a-static-binding",
        },
      }),
    ).toThrow();
  });

  it("serializes errors as structured objects", () => {
    const { logger, records } = captureLogger();

    logger.error({ err: new Error("Database unavailable") }, "Query failed");

    expect(records[0].err).toMatchObject({
      type: "Error",
      message: "Database unavailable",
    });
  });
});
