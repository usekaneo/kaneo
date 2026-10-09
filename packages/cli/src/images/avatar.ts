import { Duration, Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { fetchImage } from "./fetch-image.js";
import { imageArt } from "./image-art.js";
import { currentImageTarget } from "./image-target.js";
import type { Picture } from "./side-by-side.js";

export type Avatar = Picture & {
  readonly placement: "beside" | "above";
};

export const AVATAR_COLUMNS = 16;
export const AVATAR_ROWS = 8;
const AVATAR_TIMEOUT = Duration.seconds(3);

const loadAvatarArt = Effect.fnUntraced(function* (image: string | null) {
  if (!image) return null;
  const target = yield* currentImageTarget;
  if (target.protocol === "none") return null;
  const fetched = yield* fetchImage(image).pipe(
    Effect.timeoutOption(AVATAR_TIMEOUT),
  );
  if (fetched._tag === "None" || fetched.value._tag !== "Fetched") return null;
  const art = yield* imageArt(fetched.value.bytes, target, {
    maxColumns: AVATAR_COLUMNS,
    maxRows: AVATAR_ROWS,
    upscale: true,
  });
  if (art._tag !== "Art") return null;
  return {
    lines: art.lines,
    columns: art.columns,
    placement: target.protocol === "blocks" ? "beside" : "above",
  } satisfies Avatar;
});

export const loadAvatar = (image: string | null) =>
  loadAvatarArt(image).pipe(Effect.provide(FetchHttpClient.layer));
