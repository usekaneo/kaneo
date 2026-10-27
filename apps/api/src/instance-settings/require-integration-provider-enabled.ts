import type { Context, Next } from "hono";
import { ApiError } from "../errors/api-error";
import { getInstanceSettings } from "./get-instance-settings";

const READ_OR_REMOVE = new Set(["GET", "HEAD", "OPTIONS", "DELETE"]);

/**
 * While a provider is turned off, projects can still see and remove their
 * connection, but can't connect, change, or import through it.
 */
export function requireIntegrationProviderEnabled(type: string) {
  return async function requireProviderEnabled(c: Context, next: Next) {
    if (
      !READ_OR_REMOVE.has(c.req.method) &&
      (await getInstanceSettings()).disabledIntegrations.includes(type)
    ) {
      throw new ApiError(403, {
        code: "INTEGRATION_PROVIDER_DISABLED",
        message: "An administrator turned this integration off.",
      });
    }
    return next();
  };
}
