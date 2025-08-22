import type { Context as HonoContext } from "hono";
import { auth } from "./auth";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });

  // Extract active workspace ID from session
  // @ts-expect-error activeOrganizationId is present on session, https://github.com/better-auth/better-auth/issues/3490
  const activeWorkspaceId = session?.session?.activeOrganizationId || null;

  return {
    session,
    activeWorkspaceId,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
