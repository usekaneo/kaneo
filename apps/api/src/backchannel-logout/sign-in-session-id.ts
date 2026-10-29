import type { GenericEndpointContext } from "better-auth";
import { decodeJwtSegment } from "./decode-jwt-segment";

const signInSessionIds = new WeakMap<object, string>();

function isCustomProviderCallback(
  ctx: GenericEndpointContext | null,
): ctx is GenericEndpointContext {
  return ctx?.path === "/callback/:id" && ctx.params?.id === "custom";
}

export function rememberSignInSessionId(
  idToken: unknown,
  ctx: GenericEndpointContext | null,
) {
  if (!isCustomProviderCallback(ctx) || typeof idToken !== "string") return;
  const sid = decodeJwtSegment(idToken, 1)?.sid;
  if (typeof sid === "string" && sid) signInSessionIds.set(ctx.context, sid);
}

export function takeSignInSessionId(ctx: GenericEndpointContext | null) {
  if (!isCustomProviderCallback(ctx)) return undefined;
  const sid = signInSessionIds.get(ctx.context);
  signInSessionIds.delete(ctx.context);
  return sid;
}
