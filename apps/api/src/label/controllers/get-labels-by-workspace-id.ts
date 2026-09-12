import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { labelTable } from "../../database/schema";
import { Database } from "../../effect/database";

const getLabelsByWorkspaceId = Effect.fn("label.getLabelsByWorkspaceId")(
  function* (workspaceId: string) {
    const database = yield* Database;

    return yield* database.query((db) =>
      db
        .select()
        .from(labelTable)
        .where(eq(labelTable.workspaceId, workspaceId)),
    );
  },
);

export default getLabelsByWorkspaceId;
