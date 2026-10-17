import type { Avatar } from "./avatar.js";
import { besidePicture } from "./side-by-side.js";

const INDENT = 2;
const GAP = 3;
const MIN_TEXT_COLUMNS = 40;

export function placeAvatar(
  lines: ReadonlyArray<string>,
  avatar: Avatar | null,
  columns: number,
): string[] {
  if (!avatar) return [...lines];
  const fits = columns >= INDENT + avatar.columns + GAP + MIN_TEXT_COLUMNS;
  if (avatar.placement === "beside" && fits) {
    const body = lines.slice(1, -1).map((line) => line.replace(/^ {2}/u, ""));
    return [
      "",
      ...besidePicture(avatar, body, { indent: INDENT, gap: GAP }),
      "",
    ];
  }
  const pad = " ".repeat(INDENT);
  return ["", ...avatar.lines.map((line) => `${pad}${line}`), ...lines];
}
