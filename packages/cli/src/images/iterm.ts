import type { CellSize } from "./cell-size.js";
import { tmuxPassthrough } from "./tmux.js";

export function encodeIterm(
  bytes: Uint8Array,
  size: CellSize,
  options: { readonly tmux: boolean },
): string {
  const data = Buffer.from(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).toString("base64");
  const sequence = `\u001b]1337;File=inline=1;width=${size.columns};height=${size.rows};preserveAspectRatio=1;size=${bytes.byteLength}:${data}\u0007`;
  return options.tmux ? tmuxPassthrough(sequence) : sequence;
}
