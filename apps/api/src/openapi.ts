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

// createRoute({ middleware }) registers middleware BEFORE the request
// validators, so middleware must read the raw request, not c.req.valid().
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

// Declaring a non-2xx response widens an untagged InferResponseType on the
// frontend, so those call sites must tag the status: InferResponseType<T, 200>.
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
