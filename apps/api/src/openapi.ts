import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { Session, User } from "better-auth/types";
import { HTTPException } from "hono/http-exception";

export { createRoute } from "@hono/zod-openapi";
export { z };

export type ApiKey = {
  id: string;
  userId: string;
  enabled: boolean;
  permissions: Record<string, string[]> | null;
};

export type BaseVariables = {
  userId: string;
  userEmail: string;
  user: User | null;
  session: Session | null;
  apiKey?: ApiKey;
};

// NOTE: routes declare auth/access middleware via createRoute({ middleware }),
// which @hono/zod-openapi registers BEFORE the request validators (index.mjs:147
// -- `this.on(method, path, ...middleware, ...validators, handler)`). The
// hono-openapi routes this replaces listed validator() first, so a malformed
// body used to be rejected before any authorization ran. Order is now
// authorize-then-validate: an unauthorized caller gets 403 instead of 400 and
// no longer learns whether their body was well-formed.
export function apiRouter<V extends BaseVariables = BaseVariables>() {
  return new OpenAPIHono<{ Variables: V }>({
    defaultHook: (result) => {
      if (!result.success) {
        const issue = result.error.issues[0];
        const field = issue?.path.join(".");
        throw new HTTPException(400, {
          message: issue
            ? `${field || "request"}: ${issue.message}`
            : "Invalid request",
        });
      }
    },
  });
}

export const responseTimestamp = z
  .date()
  .openapi({ type: "string", format: "date-time" });

export const nullableResponseTimestamp = responseTimestamp
  .nullable()
  .openapi({ type: ["string", "null"], format: "date-time" });

// HTTPException bodies are the plain message string (Hono's default
// getResponse()), which every web fetcher reads with response.text().
//
// Declaring any non-2xx response puts it in the route's typed-response union,
// so an untagged InferResponseType<typeof client.x.$get> on the frontend widens
// from `Label` to `Label | string`. Tag the status instead --
// InferResponseType<typeof client.x.$get, 200> -- as src/types/project already
// does. Fetchers that narrow on `response.ok` before .json() are unaffected.
export function errorResponse(description: string) {
  return {
    description,
    content: { "text/plain": { schema: z.string() } },
  };
}

export function jsonResponse<T extends z.ZodType>(
  description: string,
  schema: T,
) {
  return {
    description,
    content: { "application/json": { schema } },
  };
}
