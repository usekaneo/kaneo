import { Effect, Option } from "effect";
import { listAssignedTasks } from "../api/endpoints.js";
import { InvalidArgument } from "../errors/errors.js";
import { Output } from "../output/output.js";
import { withSpinner } from "../output/spinner.js";
import { pick } from "../prompts/pick.js";
import { ticketId } from "../render/task-format.js";
import { resolveWorkspaceId } from "../services/selection.js";

export const askTask = Effect.fnUntraced(function* (
  reference: Option.Option<string>,
  example: string,
) {
  if (Option.isSome(reference)) return reference.value;
  const output = yield* Output;
  const missing = new InvalidArgument({
    message: "A task is required.",
    hint: `Pass a ticket id, for example ${example}.`,
  });
  if (!output.interactive) return yield* missing;
  const workspaceId = yield* resolveWorkspaceId();
  const { tasks } = yield* withSpinner("Loading your tasks")(
    listAssignedTasks(workspaceId),
  );
  if (tasks.length === 0) return yield* missing;
  return yield* pick(
    "Choose a task",
    tasks.map((task) => {
      const id = ticketId(task.projectSlug, task.number);
      return {
        title: id ? `${id} ${task.title}` : task.title,
        value: id ?? task.id,
        description: task.projectName,
      };
    }),
  );
});
