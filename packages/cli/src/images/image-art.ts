import { Effect } from "effect";
import { renderBlocks } from "./blocks.js";
import type { CellSize } from "./cell-size.js";
import {
  canDecode,
  decodeImage,
  MAX_PASSTHROUGH_PIXELS,
} from "./decode-image.js";
import {
  BLOCK_CELL,
  fitImage,
  GRAPHICS_CELL,
  MAX_IMAGE_ROWS,
} from "./fit-image.js";
import { FORMAT_LABELS, type ImageInfo, imageInfo } from "./image-info.js";
import type { ImageTarget } from "./image-target.js";
import { encodeIterm } from "./iterm.js";
import { encodeKitty } from "./kitty.js";
import { resizeRgba } from "./resize-rgba.js";
import type { RgbaImage } from "./rgba.js";

export type ImageArt =
  | ({
      readonly _tag: "Art";
      readonly lines: ReadonlyArray<string>;
    } & CellSize)
  | { readonly _tag: "Unsupported"; readonly reason: string };

export type ArtOptions = {
  readonly maxColumns: number;
  readonly maxRows?: number;
  readonly upscale?: boolean;
};

const ITERM_FORMATS = new Set(["png", "jpeg", "gif", "webp"]);
const KITTY_PIXELS_PER_COLUMN = 16;
const KITTY_PIXELS_PER_ROW = 32;

function unsupported(reason: string): ImageArt {
  return { _tag: "Unsupported", reason };
}

function art(lines: ReadonlyArray<string>, size: CellSize): ImageArt {
  return { _tag: "Art", lines, ...size };
}

function fitsPassthrough(info: ImageInfo): boolean {
  return (
    info.width > 0 &&
    info.height > 0 &&
    info.width * info.height <= MAX_PASSTHROUGH_PIXELS
  );
}

function tooLarge(info: ImageInfo): ImageArt {
  return unsupported(`${info.width}x${info.height} is too large to show`);
}

function notShown(info: ImageInfo): ImageArt {
  return unsupported(`${FORMAT_LABELS[info.format]} cannot be shown here`);
}

const decode = (bytes: Uint8Array, info: ImageInfo) =>
  Effect.tryPromise(() => decodeImage(bytes, info)).pipe(Effect.option);

const deflate = (bytes: Uint8Array) =>
  Effect.promise(async () => {
    const { deflateSync } = await import("node:zlib");
    return new Uint8Array(deflateSync(bytes));
  });

function shrinkForKitty(image: RgbaImage, size: CellSize): RgbaImage {
  const scale = Math.min(
    1,
    (size.columns * KITTY_PIXELS_PER_COLUMN) / image.width,
    (size.rows * KITTY_PIXELS_PER_ROW) / image.height,
  );
  return scale < 1
    ? resizeRgba(image, image.width * scale, image.height * scale)
    : image;
}

export const imageArt = Effect.fnUntraced(function* (
  bytes: Uint8Array,
  target: ImageTarget,
  options: ArtOptions,
) {
  const info = imageInfo(bytes);
  const limits = {
    maxColumns: options.maxColumns,
    maxRows: options.maxRows ?? MAX_IMAGE_ROWS,
  };
  const graphicsSize = () =>
    fitImage(info, { ...limits, ...GRAPHICS_CELL, upscale: options.upscale });
  const tmux = { tmux: target.tmux };

  switch (target.protocol) {
    case "none":
      return unsupported("images are turned off");
    case "iterm": {
      if (!ITERM_FORMATS.has(info.format) || info.width === 0) {
        return notShown(info);
      }
      if (!fitsPassthrough(info)) return tooLarge(info);
      const size = graphicsSize();
      return art([encodeIterm(bytes, size, tmux)], size);
    }
    case "kitty": {
      if (info.format === "png" && info.width > 0) {
        if (!fitsPassthrough(info)) return tooLarge(info);
        const size = graphicsSize();
        return art([encodeKitty({ format: "png", bytes }, size, tmux)], size);
      }
      if (info.format !== "jpeg" || !canDecode(info)) return notShown(info);
      const decoded = yield* decode(bytes, info);
      if (decoded._tag === "None") return unsupported("could not decode");
      const size = graphicsSize();
      const pixels = shrinkForKitty(decoded.value, size);
      const payload = {
        format: "rgba",
        width: pixels.width,
        height: pixels.height,
        bytes: yield* deflate(pixels.data),
        compressed: true,
      } as const;
      return art([encodeKitty(payload, size, tmux)], size);
    }
    case "blocks": {
      if (!canDecode(info)) return notShown(info);
      const decoded = yield* decode(bytes, info);
      if (decoded._tag === "None") return unsupported("could not decode");
      const size = fitImage(decoded.value, { ...limits, ...BLOCK_CELL });
      return art(
        renderBlocks(decoded.value, {
          ...size,
          level: target.level,
          background: target.background,
        }),
        size,
      );
    }
  }
});
