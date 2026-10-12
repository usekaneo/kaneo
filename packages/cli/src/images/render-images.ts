import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { Output } from "../output/output.js";
import { withSpinner } from "../output/spinner.js";
import { Session } from "../services/session.js";
import type { ImageRef } from "./extract-images.js";
import { fetchImage } from "./fetch-image.js";
import { imageColumns, MAX_IMAGE_ROWS } from "./fit-image.js";
import { imageArt } from "./image-art.js";
import { currentImageTarget } from "./image-target.js";
import { absoluteImageUrl } from "./image-url.js";
import { renderImageBlock } from "./render-image-block.js";
import { moreImagesLine, renderImageLinks } from "./render-image-links.js";

export type RenderImagesOptions = {
  readonly max?: number;
  readonly indent?: number;
  readonly maxRows?: number;
  readonly whenUnsupported?: "links" | "skip";
  readonly whenFailed?: "placeholder" | "skip";
};

export const DEFAULT_MAX_IMAGES = 10;
const CONCURRENCY = 4;

export const showImages = Effect.fnUntraced(function* (
  images: ReadonlyArray<ImageRef>,
  options: RenderImagesOptions = {},
) {
  const output = yield* Output;
  if (output.mode === "json" || images.length === 0) return;
  const session = yield* Session;
  const target = yield* currentImageTarget;
  const { ui } = output;
  const indent = options.indent ?? 2;
  const max = Math.max(1, options.max ?? DEFAULT_MAX_IMAGES);
  const shown = images.slice(0, max).map((image) => ({
    url: absoluteImageUrl(image.url, session.apiUrl),
    alt: image.alt,
  }));
  const hidden = images.length - shown.length;

  if (target.protocol === "none") {
    if (options.whenUnsupported === "skip") return;
    const lines = renderImageLinks(ui, shown, { indent, hidden });
    yield* output.out(`${lines.join("\n")}\n`);
    return;
  }

  const fetched = yield* withSpinner(
    shown.length === 1 ? "Loading image" : `Loading ${shown.length} images`,
  )(
    Effect.forEach(shown, (image) => fetchImage(image.url), {
      concurrency: CONCURRENCY,
    }),
  );
  const artOptions = {
    maxColumns: imageColumns(ui.caps.columns, indent),
    maxRows: options.maxRows ?? MAX_IMAGE_ROWS,
  };
  const lines: string[] = [];
  for (const [index, result] of fetched.entries()) {
    const image = shown[index] ?? { url: result.url, alt: "" };
    const art =
      result._tag === "Fetched"
        ? yield* imageArt(result.bytes, target, artOptions)
        : ({ _tag: "Unsupported", reason: result.reason } as const);
    if (art._tag === "Unsupported" && options.whenFailed === "skip") continue;
    lines.push(...renderImageBlock(ui, image, art, indent), "");
  }
  if (hidden > 0) {
    lines.push(`${" ".repeat(indent)}${moreImagesLine(ui, hidden)}`, "");
  }
  if (lines.length === 0) return;
  yield* output.out(`${lines.join("\n")}\n`);
});

export const renderImages = (
  images: ReadonlyArray<ImageRef>,
  options: RenderImagesOptions = {},
) => showImages(images, options).pipe(Effect.provide(FetchHttpClient.layer));
