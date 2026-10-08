import type { CellSize } from "./cell-size.js";
import { tmuxPassthrough } from "./tmux.js";

export type KittyPayload =
  | { readonly format: "png"; readonly bytes: Uint8Array }
  | {
      readonly format: "rgba";
      readonly width: number;
      readonly height: number;
      readonly bytes: Uint8Array;
      readonly compressed: boolean;
    };

export const KITTY_CHUNK = 4096;

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString(
    "base64",
  );
}

function formatKeys(payload: KittyPayload): string {
  if (payload.format === "png") return "f=100";
  const compression = payload.compressed ? ",o=z" : "";
  return `f=32,s=${payload.width},v=${payload.height}${compression}`;
}

export function encodeKitty(
  payload: KittyPayload,
  size: CellSize,
  options: { readonly tmux: boolean },
): string {
  const data = base64(payload.bytes);
  const chunks: string[] = [];
  for (let start = 0; start < data.length; start += KITTY_CHUNK) {
    chunks.push(data.slice(start, start + KITTY_CHUNK));
  }
  if (chunks.length === 0) chunks.push("");
  const first = `a=T,${formatKeys(payload)},t=d,c=${size.columns},r=${size.rows},q=2`;
  return chunks
    .map((chunk, index) => {
      const more = index < chunks.length - 1 ? 1 : 0;
      const keys = index === 0 ? `${first},m=${more}` : `m=${more},q=2`;
      const sequence = `\u001b_G${keys};${chunk}\u001b\\`;
      return options.tmux ? tmuxPassthrough(sequence) : sequence;
    })
    .join("");
}
