import { and, eq, isNotNull } from "drizzle-orm";
import { Effect } from "effect";
import { labelTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { labelById } from "../../effect/lookups";

const updateLabel = Effect.fn("label.updateLabel")(function* (
  id: string,
  name: string,
  color: string,
) {
  const database = yield* Database;

  return yield* database.transaction((tx) =>
    Effect.gen(function* () {
      const label = yield* labelById(id, tx);

      const [updatedLabel] = yield* tx.query((db) =>
        db
          .update(labelTable)
          .set({ name, color })
          .where(eq(labelTable.id, id))
          .returning(),
      );

      // If this is a workspace-level label, cascade the changes to all
      // task-level copies so existing label assignments reflect the new color/name
      if (!label.taskId && label.workspaceId) {
        const workspaceId = label.workspaceId;
        yield* tx.query((db) =>
          db
            .update(labelTable)
            .set({ name, color })
            .where(
              and(
                eq(labelTable.workspaceId, workspaceId),
                eq(labelTable.name, label.name),
                isNotNull(labelTable.taskId),
              ),
            ),
        );
      }

      return updatedLabel;
    }),
  );
});

export default updateLabel;
