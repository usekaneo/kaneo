import { Effect } from "effect";
import { labelById } from "../../effect/lookups";

const getLabel = Effect.fn("label.getLabel")(function* (id: string) {
  return yield* labelById(id);
});

export default getLabel;
