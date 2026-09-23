import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";
import {
  isSensitiveOutboundRequest,
  withoutOutboundTelemetry,
} from "../../../apps/api/src/utils/sensitive-outbound";

it("isolates sensitive delivery context from concurrent ordinary requests", async () => {
  let release!: () => void;
  const wait = new Promise<void>((done) => {
    release = done;
  });
  const sensitive = withoutOutboundTelemetry(async () => {
    expect(isSensitiveOutboundRequest()).toBe(true);
    await wait;
    expect(isSensitiveOutboundRequest()).toBe(true);
  });
  expect(isSensitiveOutboundRequest()).toBe(false);
  release();
  await sensitive;
  expect(isSensitiveOutboundRequest()).toBe(false);
});

it("keeps credentials out of actual Sentry events, breadcrumbs and spans while retaining ordinary HTTP telemetry", async () => {
  const envelopes: string[] = [];
  const paths: string[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    if (request.url?.includes("/envelope/")) {
      envelopes.push(
        (request.headers["content-encoding"] === "gzip"
          ? gunzipSync(bytes)
          : bytes
        ).toString(),
      );
      response.writeHead(200, { "content-type": "application/json" }).end("{}");
    } else {
      paths.push(request.url ?? "");
      response
        .writeHead(request.url?.includes("failure") ? 500 : 200, {
          "content-type": "application/json",
        })
        .end("{}");
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    await promisify(execFile)(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        `
      await import('./src/instrument.ts');
      const Sentry = await import('@sentry/node');
      const { sendOutboundRequest } = await import('./src/utils/outbound-request.ts');
      const { withoutOutboundTelemetry } = await import('./src/utils/sensitive-outbound.ts');
      const http = await import('node:http');
      const base = process.env.TELEMETRY_TEST_BASE;
      await Sentry.startSpan({ name: 'notification-test', op: 'test' }, async () => {
        await sendOutboundRequest(base + '/bot/FETCH_SECRET/sendMessage?token=QUERY_SECRET', { body: 'BODY_SECRET', headers: { Authorization: 'Bearer HEADER_SECRET' } });
        try { await sendOutboundRequest(base + '/failure/FAILURE_SECRET', {}); }
        catch (error) { Sentry.captureException(error); }
        await withoutOutboundTelemetry(() => new Promise((resolve, reject) => {
          http.get(base + '/hooks/HTTP_SECRET', (response) => { response.resume(); response.on('end', resolve); }).on('error', reject);
        }));
        await fetch(base + '/ordinary-http-marker');
        Sentry.captureMessage('safe-delivery-probe');
      });
      await Sentry.close(5000);
    `,
      ],
      {
        cwd: resolve(import.meta.dirname, "../../../apps/api"),
        env: {
          ...process.env,
          SENTRY_DSN: `${base.replace("://", "://public@")}/1`,
          SENTRY_TRACES_SAMPLE_RATE: "1",
          SENTRY_PROFILES_SAMPLE_RATE: "0",
          TELEMETRY_TEST_BASE: base,
        },
        timeout: 20000,
      },
    );
    expect(paths).toHaveLength(4);
    const telemetry = envelopes.join("\n");
    expect(telemetry).toContain("safe-delivery-probe");
    expect(telemetry).toContain("ordinary-http-marker");
    expect(telemetry).toContain("Outbound request failed: http");
    for (const secret of [
      "FETCH_SECRET",
      "QUERY_SECRET",
      "BODY_SECRET",
      "HEADER_SECRET",
      "FAILURE_SECRET",
      "HTTP_SECRET",
    ])
      expect(telemetry).not.toContain(secret);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
}, 30000);
