import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { Effect, Layer, Option } from "effect";
import { Argument, Command, Flag, Prompt } from "effect/cli";
import { FetchHttpClient } from "effect/http";
import { COMMENT_MAX_LENGTH, createComment } from "../../api/task-actions.js";
import { updateTaskDescription } from "../../api/task-mutations.js";
import {
  type UploadFile,
  type UploadSurface,
  uploadTaskFile,
} from "../../api/uploads.js";
import { Cancelled, InvalidArgument } from "../../errors/errors.js";
import {
  appendToDescription,
  commentWithFiles,
  type UploadedFile,
} from "../../images/attachment-markdown.js";
import {
  contentTypeFor,
  isInlineImageType,
} from "../../images/content-type.js";
import { imageColumns } from "../../images/fit-image.js";
import { imageArt } from "../../images/image-art.js";
import { currentImageTarget } from "../../images/image-target.js";
import { renderAttached } from "../../images/render-attached.js";
import { renderImageBlock } from "../../images/render-image-block.js";
import { readTextInput } from "../../input/read-text-input.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { promptTheme } from "../../prompts/prompt-theme.js";
import { fetchTask, resolveTask } from "../../tasks/resolve-task.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";

const FILES_HINT = "For example: kaneo task attach KAN-12 screenshot.png";
const INDENT = 2;

const askForFile = Effect.fnUntraced(function* () {
  const output = yield* Output;
  return yield* Prompt.run(
    Prompt.String({
      message: "File to attach",
      validate: (value) =>
        value.trim() === ""
          ? Effect.fail("Enter a file path, or press Ctrl+C to cancel")
          : Effect.succeed(value.trim()),
      theme: promptTheme(output.ui),
    }),
  ).pipe(Effect.catchTag("QuitError", () => Effect.fail(new Cancelled())));
});

const filePaths = Effect.fnUntraced(function* (paths: ReadonlyArray<string>) {
  if (paths.length > 0) return paths;
  const output = yield* Output;
  if (output.interactive) return [yield* askForFile()];
  return yield* new InvalidArgument({
    message: "Pass one or more files to attach.",
    hint: FILES_HINT,
  });
});

const readLocalFile = Effect.fnUntraced(function* (
  path: string,
  comment: boolean,
) {
  const bytes = yield* Effect.tryPromise({
    try: () => readFile(path),
    catch: () =>
      new InvalidArgument({
        message: `Could not read ${path}.`,
        hint: comment
          ? "Check the path. To write text in the comment, pass it with -m."
          : "Check the path and that the file is readable.",
      }),
  });
  if (bytes.byteLength === 0) {
    return yield* new InvalidArgument({ message: `${path} is empty.` });
  }
  const name = basename(path);
  return {
    name,
    bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    contentType: contentTypeFor(name, bytes),
  } satisfies UploadFile;
});

const previewLines = Effect.fnUntraced(function* (
  files: ReadonlyArray<UploadFile>,
  uploaded: ReadonlyArray<UploadedFile>,
) {
  const output = yield* Output;
  const target = yield* currentImageTarget;
  if (target.protocol === "none") return [];
  const lines: string[] = [];
  for (const [index, file] of uploaded.entries()) {
    const bytes = files[index]?.bytes;
    if (file.kind !== "image" || !bytes) continue;
    const art = yield* imageArt(bytes, target, {
      maxColumns: imageColumns(output.ui.caps.columns, INDENT),
    });
    if (art._tag !== "Art") continue;
    lines.push(
      ...renderImageBlock(
        output.ui,
        { url: file.url, alt: file.name },
        art,
        INDENT,
      ),
      "",
    );
  }
  return lines;
});

export const runTaskAttach = Effect.fn("command.task.attach")(
  function* (options: {
    readonly task: string;
    readonly files: ReadonlyArray<string>;
    readonly comment: boolean;
    readonly message: Option.Option<string>;
    readonly messageFile: Option.Option<string>;
  }) {
    const session = yield* Session;
    const message = yield* readTextInput({
      value: options.message,
      file: options.messageFile,
      flag: "--message",
    });
    const target: UploadSurface =
      options.comment || Option.isSome(message) ? "comment" : "description";
    const text = Option.getOrElse(message, () => "");
    if (text.length > COMMENT_MAX_LENGTH) {
      return yield* new InvalidArgument({
        message: `The comment is ${text.length} characters long, and the limit is ${COMMENT_MAX_LENGTH}.`,
      });
    }
    const paths = yield* filePaths(options.files);
    const files = yield* Effect.forEach(paths, (path) =>
      readLocalFile(path, options.comment),
    );
    const resolved = yield* withSpinner(`Loading ${options.task.trim()}`)(
      resolveTask(options.task),
    );
    const label = resolved.ticketId ?? resolved.task.id.slice(0, 8);

    if (target === "comment") {
      const estimate = commentWithFiles(
        text,
        files.map((file) => ({
          name: file.name,
          url: `${session.apiUrl}/api/asset/${"x".repeat(32)}`,
          contentType: file.contentType,
          size: file.bytes.byteLength,
          kind: isInlineImageType(file.contentType) ? "image" : "attachment",
        })),
      );
      if (estimate.length > COMMENT_MAX_LENGTH) {
        return yield* new InvalidArgument({
          message: `The comment would be about ${estimate.length} characters long, and the limit is ${COMMENT_MAX_LENGTH}.`,
          hint: "Attach fewer files, or shorten the message.",
        });
      }
    }

    const uploaded: UploadedFile[] = [];
    for (const [index, file] of files.entries()) {
      const progress =
        files.length > 1 ? ` (${index + 1}/${files.length})` : "";
      const asset = yield* withSpinner(`Uploading ${file.name}${progress}`)(
        uploadTaskFile(resolved.task.id, file, target),
      );
      uploaded.push({
        name: file.name,
        url: asset.url,
        contentType: file.contentType,
        size: file.bytes.byteLength,
        kind: isInlineImageType(file.contentType) ? "image" : "attachment",
      });
    }

    if (target === "description") {
      yield* withSpinner(`Updating ${label}`)(
        fetchTask(resolved.task.id).pipe(
          Effect.flatMap((latest) =>
            updateTaskDescription(
              resolved.task.id,
              appendToDescription(latest.description, uploaded),
            ),
          ),
        ),
      );
    } else {
      const content = commentWithFiles(text, uploaded);
      if (content.length > COMMENT_MAX_LENGTH) {
        return yield* new InvalidArgument({
          message: `The comment would be ${content.length} characters long, and the limit is ${COMMENT_MAX_LENGTH}.`,
          hint: "Attach fewer files, or shorten the message.",
        });
      }
      yield* withSpinner(`Commenting on ${label}`)(
        createComment(resolved.task.id, content),
      );
    }

    const previews = yield* previewLines(files, uploaded);
    yield* emit(
      {
        files: uploaded.map(({ name, url, kind }) => ({ name, url, kind })),
        target,
      },
      (ui) => [
        "",
        ...previews,
        ...renderAttached(ui, {
          label,
          url: resolved.url,
          names: uploaded.map((file) => file.name),
          target,
        }),
      ],
    );
  },
);

export const taskAttach = Command.make(
  "attach",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or a task id"),
    ),
    files: Argument.String("file").pipe(
      Argument.withDescription("Files to upload; images are shown inline"),
      Argument.variadic(),
    ),
    comment: Flag.Boolean("comment").pipe(
      Flag.withDescription(
        "Post the files as a new comment instead of adding them to the description",
      ),
      Flag.withDefault(false),
    ),
    message: Flag.String("message").pipe(
      Flag.withAlias("m"),
      Flag.withDescription(
        "Comment text to post with the files (implies --comment); - reads stdin",
      ),
      Flag.optional,
    ),
    messageFile: Flag.String("message-file").pipe(
      Flag.withAlias("F"),
      Flag.withDescription(
        "Read the comment text from a file, or - for stdin (implies --comment)",
      ),
      Flag.optional,
    ),
  },
  (options) => runTaskAttach(options),
).pipe(
  Command.withDescription(
    "Upload files to a task and add them to its description or a comment",
  ),
  Command.provide(Layer.merge(ApiLayer, FetchHttpClient.layer)),
);
