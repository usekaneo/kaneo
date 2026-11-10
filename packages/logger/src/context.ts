/**
 * Request-scoped structured logging context.
 *
 * Provides correlation metadata across async operations without
 * explicitly passing a logger through every function.
 *
 * Shared by server-side consumers of this module instance.
 *
 * SECURITY:
 * - Node.js only. Never import from client-side code.
 * - Logging context is not an authorization boundary.
 * - Use scoped overrides for concurrent tenant-specific work.
 * - Detach long-lived background jobs at their scheduling boundary.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

const IdentifierSchema = z.string().trim().min(1).max(128);

const RequestIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(
    /^[\x21-\x7E]+$/,
    "Request ID must contain printable ASCII without spaces",
  );

const RouteSchema = z.string().trim().min(1).max(200);

/**
 * Keep ambient custom fields small and serializable.
 * Arbitrary objects, errors, credentials, and request bodies
 * should not be stored in the logging context.
 */
const LogFieldValueSchema = z.union([
  z.string().max(512),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const RESERVED_FIELDS = new Set([
  "request_id",
  "route",
  "workspace_key",
  "user_id",
  "fields",
  "level",
  "time",
  "msg",
]);

const LogFieldNameSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_.-]{0,63}$/)
  .refine(
    (name: string) => !RESERVED_FIELDS.has(name),
    "Reserved logging field name",
  );

const LogFieldsSchema = z
  .record(LogFieldNameSchema, LogFieldValueSchema)
  .refine(
    (fields) => Object.keys(fields).length <= 32,
    "Maximum 32 custom logging fields",
  );

const OptionalContextFields = {
  route: RouteSchema.optional(),
  workspace_key: IdentifierSchema.optional(),
  user_id: IdentifierSchema.optional(),
  fields: LogFieldsSchema.optional(),
};

/**
 * Complete request context.
 *
 * request_id is required and immutable for the lifetime
 * of an individual request scope.
 */
export const LogContextSchema = z.strictObject({
  request_id: RequestIdSchema,
  ...OptionalContextFields,
});

/**
 * Permitted updates to an existing context.
 *
 * request_id cannot be changed, and unknown top-level
 * properties are rejected rather than silently accepted.
 */
export const LogContextPatchSchema = z.strictObject({
  ...OptionalContextFields,
});

export type LogContext = z.infer<typeof LogContextSchema>;
export type LogContextPatch = z.infer<typeof LogContextPatchSchema>;

/**
 * Read-only public representation of a logging context.
 */
export type LogContextSnapshot = Readonly<Omit<LogContext, "fields">> & {
  readonly fields?: Readonly<NonNullable<LogContext["fields"]>>;
};

// -----------------------------------------------------------------------------
// Storage
// -----------------------------------------------------------------------------

interface LogContextStore {
  current: LogContextSnapshot;
}

/**
 * One storage instance per loaded module instance.
 *
 * The mutable store wrapper allows intentional request-wide updates,
 * while consumers only receive immutable snapshots.
 */
const storage = new AsyncLocalStorage<LogContextStore | undefined>();

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

function freezeContext(context: LogContext): LogContextSnapshot {
  return Object.freeze({
    ...context,
    ...(context.fields === undefined
      ? {}
      : {
          fields: Object.freeze({ ...context.fields }),
        }),
  });
}

/**
 * Validate and merge an update atomically.
 *
 * If validation fails, the existing context remains untouched.
 * Custom fields are merged rather than replaced.
 */
function mergeContext(
  current: LogContextSnapshot,
  patch: LogContextPatch,
): LogContextSnapshot {
  const validatedPatch = LogContextPatchSchema.parse(patch);

  const merged = LogContextSchema.parse({
    ...current,
    ...validatedPatch,
    ...(validatedPatch.fields === undefined
      ? {}
      : {
          fields: {
            ...current.fields,
            ...validatedPatch.fields,
          },
        }),
  });

  return freezeContext(merged);
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Return the active immutable logging context.
 *
 * Returns undefined outside an active request scope.
 * Does not allocate or revalidate on each log read.
 */
export function getLogContext(): LogContextSnapshot | undefined {
  return storage.getStore()?.current;
}

/**
 * Return a flattened object suitable for structured loggers.
 *
 * Reserved context fields take precedence over custom fields.
 */
export function getLogFields() {
  const context = getLogContext();

  if (!context) return {};

  const { fields, ...base } = context;

  return {
    ...fields,
    ...base,
  };
}

/**
 * Validate an incoming correlation ID or generate one.
 *
 * Invalid or missing external IDs are replaced with UUIDs.
 */
export function resolveRequestId(candidate: unknown): string {
  const result = RequestIdSchema.safeParse(candidate);

  return result.success ? result.data : randomUUID();
}

/**
 * Establish a new request context.
 *
 * The context propagates through async operations created
 * within fn, including Promise continuations and timers.
 *
 * Synchronous and async callbacks are both supported.
 */
export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
  const validated = LogContextSchema.parse(context);

  return storage.run({ current: freezeContext(validated) }, fn);
}

/**
 * Enrich the current request context.
 *
 * Updates are visible to all async branches sharing this
 * request store.
 *
 * No-op outside an active context, preserving the original API.
 *
 * For branch-specific tenant metadata, use
 * runWithScopedLogContext instead.
 */
export function setLogContext(patch: LogContextPatch): void {
  const store = storage.getStore();

  if (!store) return;

  store.current = mergeContext(store.current, patch);
}

/**
 * Create an isolated child scope derived from the active context.
 *
 * Changes to this scope do not mutate the parent or sibling scopes.
 *
 * Useful when a request launches concurrent work across
 * multiple workspaces.
 */
export function runWithScopedLogContext<T>(
  patch: LogContextPatch,
  fn: () => T,
): T {
  const parent = storage.getStore();

  if (!parent) {
    throw new Error("runWithScopedLogContext requires an active log context");
  }

  return storage.run(
    {
      current: mergeContext(parent.current, patch),
    },
    fn,
  );
}

/**
 * Execute fn without inheriting the current logging context.
 *
 * Timers, intervals, promises, and other async operations
 * created inside fn inherit an undefined logging context.
 *
 * Intended for process-lifetime work scheduled from a request.
 *
 * Only detaches this AsyncLocalStorage instance. Other ALS
 * stores and explicitly captured variables remain unaffected.
 */
export function runWithoutLogContext<T>(fn: () => T): T {
  return storage.run(undefined, fn);
}
