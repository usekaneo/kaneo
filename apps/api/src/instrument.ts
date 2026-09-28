import { readFileSync } from "node:fs";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { isSensitiveOutboundRequest } from "./utils/sensitive-outbound";

function parseSampleRate(value: string | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0;
}

const tracesSampleRate = parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE);

const profilesSampleRate = parseSampleRate(
  process.env.SENTRY_PROFILES_SAMPLE_RATE,
);

function readAppVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
    );
    return typeof pkg.version === "string" ? pkg.version : undefined;
  } catch {
    return undefined;
  }
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment:
      process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "production",
    release: process.env.SENTRY_RELEASE ?? readAppVersion(),
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
    },
    tracesSampleRate,
    profileSessionSampleRate: profilesSampleRate,
    profileLifecycle: "trace",
    integrations: [
      nodeProfilingIntegration(),
      Sentry.httpIntegration({
        ignoreOutgoingRequests: isSensitiveOutboundRequest,
      }),
      Sentry.nativeNodeFetchIntegration({
        ignoreOutgoingRequests: isSensitiveOutboundRequest,
      }),
    ],
  });
}
