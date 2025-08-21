import { TRPCError, initTRPC } from "@trpc/server";
import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

export const workspaceProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.activeWorkspaceId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No active workspace found. Please select a workspace.",
      cause: "No active workspace",
    });
  }
  return next({
    ctx: {
      ...ctx,
      activeWorkspaceId: ctx.activeWorkspaceId,
    },
  });
});
