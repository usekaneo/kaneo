import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { InvalidArgument } from "../../errors/errors.js";
import { extractImages } from "../../images/extract-images.js";
import { renderImages } from "../../images/render-images.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { Session } from "../../services/session.js";
import { loadTaskView } from "../../task-view/load-task-view.js";
import { renderTaskSections } from "../../task-view/render-task-sections.js";
import { sectionValue } from "../../task-view/section-result.js";
import { toTaskViewJson } from "../../task-view/task-view-json.js";
import { renderTaskDetail } from "../../tasks/render-task-detail.js";
import { ApiLayer } from "../api-layer.js";

const DEFAULT_COMMENTS = 3;
const DEFAULT_IMAGES = 3;

const checkCount = (value: Option.Option<number>, flag: string) =>
  Option.isSome(value) && value.value < 0
    ? Effect.fail(
        new InvalidArgument({
          message: `${flag} must be 0 or more.`,
          hint: `For example: ${flag} 5, or ${flag} 0 to skip.`,
        }),
      )
    : Effect.void;

export const runTaskView = Effect.fn("command.task.view")(function* (options: {
  readonly task: string;
  readonly comments: Option.Option<number>;
  readonly images: Option.Option<number>;
  readonly noImages: boolean;
  readonly full: boolean;
}) {
  yield* checkCount(options.comments, "--comments");
  yield* checkCount(options.images, "--images");
  const session = yield* Session;
  const output = yield* Output;
  const all = Number.POSITIVE_INFINITY;
  const commentLimit = Option.getOrElse(options.comments, () =>
    options.full ? all : DEFAULT_COMMENTS,
  );
  const imageLimit = options.noImages
    ? 0
    : Option.getOrElse(options.images, () =>
        options.full ? all : DEFAULT_IMAGES,
      );

  const loaded = yield* withSpinner(`Loading ${options.task.trim()}`)(
    loadTaskView(options.task, { comments: commentLimit > 0 }),
  );
  const now = new Date();
  const json = toTaskViewJson({
    ...loaded,
    webUrl: session.webUrl,
    commentLimit,
    now,
  });
  const statusFinal =
    loaded.resolved.columns.find((column) => column.slug === json.status)
      ?.isFinal ?? false;

  yield* emit(json, (ui, task) =>
    renderTaskDetail(ui, { task, statusFinal, now, full: options.full }),
  );
  if (output.mode !== "human") return;

  const images = imageLimit > 0 ? extractImages(json.description ?? "") : [];
  if (images.length > 0) {
    yield* renderImages(images, {
      max: imageLimit,
      indent: 4,
      whenUnsupported: "skip",
      whenFailed: "skip",
    });
  }
  const sections = renderTaskSections(output.ui, {
    task: json,
    commentTotal: sectionValue(loaded.sections.comments)?.length ?? 0,
    now,
    full: options.full,
  });
  if (sections.length > 0) yield* output.out(`${sections.join("\n")}\n`);
});

export const taskView = Command.make(
  "view",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or a task id"),
    ),
    comments: Flag.Int("comments").pipe(
      Flag.withDescription(
        `Show the latest N comments (default ${DEFAULT_COMMENTS}, 0 to skip them)`,
      ),
      Flag.optional,
    ),
    images: Flag.Int("images").pipe(
      Flag.withDescription(
        `Show up to N images from the description inline (default ${DEFAULT_IMAGES})`,
      ),
      Flag.optional,
    ),
    noImages: Flag.Boolean("no-images").pipe(
      Flag.withDescription("Do not show images from the description"),
      Flag.withDefault(false),
    ),
    full: Flag.Boolean("full").pipe(
      Flag.withDescription(
        "Show the whole description, every comment in full and every image",
      ),
      Flag.withDefault(false),
    ),
  },
  (options) => runTaskView(options),
).pipe(
  Command.withDescription(
    "Show a task with its details, description, subtasks, links, fields and recent comments",
  ),
  Command.provide(ApiLayer),
);
