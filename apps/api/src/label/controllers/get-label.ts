import { Effect } from "effect";
import { Database } from "../../effect/database";
import { LabelNotFound } from "../errors";

const getLabel = Effect.fn("label.getLabel")(function* (id: string) {
  const database = yield* Database;

  const label = yield* database.query((db) =>
    db.query.labelTable.findFirst({
      where: (label, { eq }) => eq(label.id, id),
    }),
  );

  if (!label) {
    return yield* new LabelNotFound({ id });
  }

  return label;
});

export default getLabel;
