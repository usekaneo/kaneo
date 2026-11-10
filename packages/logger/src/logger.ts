/**
 * Shared structured application logger.
 *
 * Emits newline-delimited JSON directly to stdout.
 * Log collection and transport belong to the infrastructure layer.
 *
 * Every emitted record includes:
 * - service_name
 * - level, time, msg
 *
 * When available, records also include:
 * - request_id, route, workspace_key, user_id
 * - trace_id, span_id
 * - validated custom request attributes
 *
 * Design constraints:
 * - Server-only (Node.js / compatible Bun server runtime).
 * - Configuration is validated once at logger construction.
 * - No in-process transport or pretty printer.
 * - Ambient context is resolved at log-call time.
 * - Trusted correlation fields override caller-supplied fields.
 * - Redaction removes known sensitive fields and containers.
 *
 * Logging context is diagnostic metadata, not authorization state.
 */

import pino from "pino";
import { context, isSpanContextValid, trace } from "@opentelemetry/api";
import { z } from "zod";

import { getLogContext } from "./context.js";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_SERVICE_NAME = "quackback" as const;

const LOG_LEVELS = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "silent",
] as const;

/**
 * Fields owned by Pino, application infrastructure, or OTel.
 *
 * These must not be accepted as arbitrary static bindings
 * or as caller-supplied structured log fields.
 */
const PROTECTED_LOG_FIELDS = new Set([
  "level",
  "time",
  "msg",
  "pid",
  "hostname",
  "service_name",
  "request_id",
  "route",
  "workspace_key",
  "user_id",
  "trace_id",
  "span_id",
]);

// -----------------------------------------------------------------------------
// Configuration schemas
// -----------------------------------------------------------------------------

export const LogLevelSchema = z.enum(LOG_LEVELS);

export type LogLevel = z.infer<typeof LogLevelSchema>;

const ServiceNameSchema = z.string().trim().min(1).max(128);

/**
 * Restrict static bindings to small, serializable primitives.
 *
 * Large objects, arrays, errors, and request payloads do not
 * belong in static logger bindings.
 */
const StaticBindingValueSchema = z.union([
  z.string().trim().min(1).max(256),
  z.number().finite(),
  z.boolean(),
]);

export const StaticLogBindingsSchema = z
  .record(
    z
      .string()
      .regex(
        /^[a-z][a-z0-9_]{0,63}$/,
        "Use lowercase snake_case binding names",
      ),
    StaticBindingValueSchema,
  )
  .superRefine((bindings, ctx) => {
    if (Object.keys(bindings).length > 16) {
      ctx.addIssue({
        code: "custom",
        message: "Maximum 16 static logger bindings",
      });
    }

    for (const key of Object.keys(bindings)) {
      if (key !== "service_name" && PROTECTED_LOG_FIELDS.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `Reserved logger field: ${key}`,
        });
      }
    }

    if (
      bindings.service_name !== undefined &&
      typeof bindings.service_name !== "string"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["service_name"],
        message: "service_name must be a string",
      });
    }
  });

export const LoggerConfigSchema = z.strictObject({
  level: LogLevelSchema.optional(),
  base: StaticLogBindingsSchema.optional(),
});

export type StaticLogBindings = z.infer<typeof StaticLogBindingsSchema>;

export type CreateLoggerOptions = z.input<typeof LoggerConfigSchema> & {
  /**
   * Optional output destination, primarily for tests.
   *
   * Production should use Pino's default stdout destination.
   */
  destination?: pino.DestinationStream;
};

/**
 * Preserve Pino compatibility for consumers.
 *
 * Consumers should import this alias instead of depending
 * on Pino's type directly.
 */
export type AppLogger = pino.Logger;

// -----------------------------------------------------------------------------
// Environment configuration
// -----------------------------------------------------------------------------

let warnedInvalidLogLevel = false;

/**
 * LOG_LEVEL overrides the default threshold.
 *
 * Tests default to silent; other environments default to info.
 * Invalid environment values cause one warning and fall back
 * instead of preventing application startup.
 */
function resolveDefaultLogLevel(): LogLevel {
  const fallback: LogLevel =
    process.env.NODE_ENV === "test" ? "silent" : "info";

  const raw = process.env.LOG_LEVEL?.trim().toLowerCase();

  if (!raw) return fallback;

  const result = LogLevelSchema.safeParse(raw);

  if (result.success) return result.data;

  if (!warnedInvalidLogLevel) {
    warnedInvalidLogLevel = true;

    process.stderr.write(`[logger] Invalid LOG_LEVEL; using "${fallback}"\n`);
  }

  return fallback;
}

function resolveServiceName(bindings: StaticLogBindings | undefined): string {
  const environmentName = process.env.OTEL_SERVICE_NAME?.trim();

  return ServiceNameSchema.parse(
    bindings?.service_name ?? (environmentName || DEFAULT_SERVICE_NAME),
  );
}

// -----------------------------------------------------------------------------
// Redaction policy
// -----------------------------------------------------------------------------

/**
 * Sensitive scalar property names.
 *
 * Redaction is intentionally case-sensitive, matching Pino's
 * property-path semantics.
 *
 * Include known spellings rather than relying on fuzzy matching.
 */
const SENSITIVE_FIELDS = [
  "password",
  "passwordHash",
  "passphrase",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "sessionToken",
  "apiKey",
  "api_key",
  "secret",
  "secretKey",
  "clientSecret",
  "client_secret",
  "signingSecret",
  "widgetSecret",
  "botToken",
  "privateKey",
  "authorization",
  "Authorization",
  "cookie",
  "Cookie",
  "email",
  "phone",
  "ssn",
] as const;

/**
 * Potentially sensitive object containers.
 *
 * Remove the complete container rather than attempting to
 * enumerate every credential that might be nested inside it.
 *
 * In particular, raw headers and request bodies should never
 * be shipped to centralized logging.
 */
const SENSITIVE_CONTAINERS = [
  "headers",
  "body",
  "rawBody",
  "input",
  "payload",
  "sealedPayload",
  "draft",
  "values",
  "fields",
  "credentials",
  "secrets",
  "formData",
] as const;

/**
 * Names requiring bracket syntax for Pino's redaction paths.
 */
const SPECIAL_SENSITIVE_FIELDS = [
  "set-cookie",
  "access-key-id",
  "secret-access-key",
  ".dockerconfigjson",
] as const;

/**
 * Generate redaction paths exclusively from trusted static
 * constants. Never construct redaction paths from request data.
 *
 * Generic matching covers top-level and one nested level.
 * Sensitive containers cover their entire subtrees.
 *
 * This is not arbitrary-depth recursive redaction.
 */
function buildRedactionPaths(): string[] {
  const paths = new Set<string>();

  for (const key of SENSITIVE_FIELDS) {
    paths.add(key);
    paths.add(`*.${key}`);
  }

  for (const key of SENSITIVE_CONTAINERS) {
    paths.add(key);
    paths.add(`*.${key}`);
  }

  for (const key of SPECIAL_SENSITIVE_FIELDS) {
    const bracketPath = `["${key}"]`;

    paths.add(bracketPath);
    paths.add(`*${bracketPath}`);
  }

  return [...paths];
}

const REDACT_PATHS = buildRedactionPaths();

// -----------------------------------------------------------------------------
// Ambient context
// -----------------------------------------------------------------------------

/**
 * Resolve trusted request metadata from AsyncLocalStorage.
 *
 * The context module exposes validated, immutable snapshots.
 * Its custom `fields` container must be flattened, because
 * the log format uses flat JSON properties.
 *
 * Reserved infrastructure keys are never taken from custom fields.
 */
function getAmbientLogFields(): Record<string, unknown> {
  const current = getLogContext();

  if (!current) return {};

  const result: Record<string, unknown> = {};

  if (current.fields) {
    for (const [key, value] of Object.entries(current.fields)) {
      if (!PROTECTED_LOG_FIELDS.has(key)) {
        result[key] = value;
      }
    }
  }

  result.request_id = current.request_id;

  if (current.route !== undefined) {
    result.route = current.route;
  }

  if (current.workspace_key !== undefined) {
    result.workspace_key = current.workspace_key;
  }

  if (current.user_id !== undefined) {
    result.user_id = current.user_id;
  }

  return result;
}

/**
 * Resolve the active OpenTelemetry span context.
 *
 * A span can exist without having valid correlation IDs.
 * Do not emit the all-zero or otherwise invalid identifiers
 * used by non-recording / invalid span contexts.
 */
function getTraceLogFields(): Record<string, string> {
  const activeSpan = trace.getSpan(context.active());

  if (!activeSpan) return {};

  const spanContext = activeSpan.spanContext();

  if (!isSpanContextValid(spanContext)) return {};

  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
  };
}

/**
 * Called by Pino for each enabled log event.
 *
 * Create a fresh object every time. Pino may mutate the result
 * while combining it with the caller's structured fields.
 */
function mixin(): Record<string, unknown> {
  return {
    ...getAmbientLogFields(),
    ...getTraceLogFields(),
  };
}

/**
 * Give trusted ambient metadata precedence over fields supplied
 * by ordinary logging calls.
 *
 * Also remove protected infrastructure fields supplied by callers
 * when there is no corresponding ambient value.
 *
 * Always return a new object: Pino must not mutate caller-owned
 * objects through this merge operation.
 */
function mergeLogFields(logObject: object, ambientFields: object): object {
  const sanitized: Record<string, unknown> = {
    ...logObject,
  };

  for (const key of PROTECTED_LOG_FIELDS) {
    delete sanitized[key];
  }

  return {
    ...sanitized,
    ...ambientFields,
  };
}

// -----------------------------------------------------------------------------
// Logger factory
// -----------------------------------------------------------------------------

/**
 * Create a structured application logger.
 *
 * Configuration is validated once. Logging itself performs no
 * Zod parsing, preserving Pino's normal fast path.
 *
 * Production:
 *   createLogger({
 *     base: { service_name: 'quackback-web' },
 *   })
 *
 * Tests:
 *   createLogger({
 *     level: 'trace',
 *     destination: captureStream,
 *   })
 */
export function createLogger(options: CreateLoggerOptions = {}): AppLogger {
  const { destination, ...rawConfig } = options;

  const config = LoggerConfigSchema.parse(rawConfig);

  if (destination !== undefined && typeof destination.write !== "function") {
    throw new TypeError("Logger destination must provide a write() function");
  }

  const level = config.level ?? resolveDefaultLogLevel();
  const serviceName = resolveServiceName(config.base);

  const pinoOptions: pino.LoggerOptions = {
    level,

    /**
     * Explicit base object also avoids automatically including
     * PID and hostname when they are not useful labels.
     */
    base: {
      ...config.base,
      service_name: serviceName,
    },

    /**
     * String level names for Grafana / Loki ingestion.
     */
    formatters: {
      level: (label) => ({ level: label }),
    },

    /**
     * Keys are removed from serialized records.
     * Nothing matching these paths reaches the output stream.
     */
    redact: {
      paths: REDACT_PATHS,
      remove: true,
    },

    /**
     * Preserve structured error serialization.
     *
     * Error messages and stack traces can themselves contain
     * sensitive text; callers must still sanitize exceptions.
     */
    serializers: {
      err: pino.stdSerializers.err,
    },

    /**
     * Request and trace metadata are resolved per log call.
     */
    mixin,

    /**
     * Prevent ordinary structured fields from impersonating
     * application or tracing metadata.
     */
    mixinMergeStrategy: mergeLogFields,
  };

  return destination === undefined
    ? pino(pinoOptions)
    : pino(pinoOptions, destination);
}
