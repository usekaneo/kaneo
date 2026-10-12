import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { InvalidArgument } from "../../errors/errors.js";
import { extractImages } from "../../images/extract-images.js";
import { absoluteImageUrl } from "../../images/image-url.js";
import {
  DEFAULT_MAX_IMAGES,
  renderImages,
} from "../../images/render-images.js";
import { renderImagesHeading } from "../../images/render-images-heading.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { Session } from "../../services/session.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { ApiLayer } from "../api-layer.js";

export const runTaskImages = Effect.fn("command.task.images")(
  function* (options: {
    readonly task: string;
    readonly max: Option.Option<number>;
  }) {
    if (Option.isSome(options.max) && options.max.value < 1) {
      return yield* new InvalidArgument({
        message: "--max must be 1 or more.",
        hint: "For example: --max 3",
      });
    }
    const session = yield* Session;
    const output = yield* Output;
    const resolved = yield* withSpinner(`Loading ${options.task.trim()}`)(
      resolveTask(options.task),
    );
    const found = extractImages(resolved.task.description ?? "").map(
      (image) => ({
        url: absoluteImageUrl(image.url, session.apiUrl),
        alt: image.alt,
      }),
    );
    const images =
      output.mode === "json" && Option.isSome(options.max)
        ? found.slice(0, options.max.value)
        : found;
    yield* emit(images, (ui) =>
      renderImagesHeading(ui, {
        label: resolved.ticketId ?? resolved.task.id.slice(0, 8),
        title: resolved.task.title,
        url: resolved.url,
        count: images.length,
      }),
    );
    yield* renderImages(images, {
      max: Option.getOrElse(options.max, () => DEFAULT_MAX_IMAGES),
    });
  },
);

export const taskImages = Command.make(
  "images",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or a task id"),
    ),
    max: Flag.Int("max").pipe(
      Flag.withDescription(
        `Show at most this many images (default ${DEFAULT_MAX_IMAGES}; JSON lists every image unless set)`,
      ),
      Flag.optional,
    ),
  },
  (options) => runTaskImages(options),
).pipe(
  Command.withDescription(
    "Show the images in a task description inline, or list their links",
  ),
  Command.provide(ApiLayer),
);
