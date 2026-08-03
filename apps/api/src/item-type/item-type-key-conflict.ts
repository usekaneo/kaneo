import { HTTPException } from "hono/http-exception";

const ITEM_TYPE_WORKSPACE_KEY_CONSTRAINT = "item_type_workspace_key_unique";

type ErrorWithDatabaseMetadata = {
  cause?: unknown;
  code?: unknown;
  constraint?: unknown;
};

export function rethrowItemTypeKeyConflict(error: unknown): never {
  const visited = new Set<unknown>();
  let current = error;

  while (
    typeof current === "object" &&
    current !== null &&
    !visited.has(current)
  ) {
    visited.add(current);
    const candidate = current as ErrorWithDatabaseMetadata;
    if (
      candidate.code === "23505" &&
      candidate.constraint === ITEM_TYPE_WORKSPACE_KEY_CONSTRAINT
    ) {
      throw new HTTPException(409, {
        message: "An item type with this key already exists",
      });
    }
    current = candidate.cause;
  }

  throw error;
}
