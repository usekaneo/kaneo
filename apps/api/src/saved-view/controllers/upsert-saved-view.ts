import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { savedViewTable } from "../../database/schema";
import validateProjectScope from "../validate-project-scope";

export type UpsertSavedViewInput = {
  workspaceId: string;
  projectId?: string | null;
  userId?: string | null;
  key: string;
  name: string;
  type: "board" | "list" | "gantt";
  position: number;
  enabled: boolean;
  configuration: Record<string, unknown>;
};

type ErrorWithDatabaseMetadata = {
  cause?: unknown;
  code?: unknown;
  constraint?: unknown;
};

function rethrowSavedViewDatabaseError(error: unknown): never {
  const visited = new Set<unknown>();
  let current = error;

  while (
    typeof current === "object" &&
    current !== null &&
    !visited.has(current)
  ) {
    visited.add(current);
    const candidate = current as ErrorWithDatabaseMetadata;

    if (candidate.code === "23505") {
      throw new HTTPException(409, {
        message: "A saved view with this scope and key already exists",
      });
    }

    if (candidate.code === "23503") {
      throw new HTTPException(400, {
        message: "Invalid saved view workspace, project, or user scope",
      });
    }

    current = candidate.cause;
  }

  throw error;
}

async function upsertSavedView(input: UpsertSavedViewInput) {
  const projectId = input.projectId ?? null;
  const userId = input.userId ?? null;

  if (projectId) {
    await validateProjectScope(input.workspaceId, projectId);
  }

  let savedView: typeof savedViewTable.$inferSelect | undefined;
  try {
    [savedView] = await db
      .insert(savedViewTable)
      .values({
        workspaceId: input.workspaceId,
        projectId,
        userId,
        key: input.key,
        name: input.name,
        type: input.type,
        position: input.position,
        enabled: input.enabled,
        configuration: input.configuration,
      })
      .onConflictDoUpdate({
        target: [
          savedViewTable.workspaceId,
          savedViewTable.projectId,
          savedViewTable.userId,
          savedViewTable.key,
        ],
        set: {
          name: input.name,
          type: input.type,
          position: input.position,
          enabled: input.enabled,
          configuration: input.configuration,
          updatedAt: new Date(),
        },
      })
      .returning();
  } catch (error) {
    rethrowSavedViewDatabaseError(error);
  }

  if (!savedView) {
    throw new HTTPException(500, { message: "Failed to save view" });
  }

  return savedView;
}

export default upsertSavedView;
