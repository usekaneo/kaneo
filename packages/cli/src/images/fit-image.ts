import type { CellSize } from "./cell-size.js";

export type FitOptions = {
  readonly maxColumns: number;
  readonly maxRows: number;
  readonly pixelsPerColumn: number;
  readonly pixelsPerRow: number;
  readonly upscale?: boolean;
};

export const MAX_IMAGE_COLUMNS = 64;
export const MAX_IMAGE_ROWS = 20;

export const BLOCK_CELL = { pixelsPerColumn: 1, pixelsPerRow: 2 } as const;
export const GRAPHICS_CELL = { pixelsPerColumn: 8, pixelsPerRow: 16 } as const;

export function imageColumns(terminalColumns: number, indent: number): number {
  return Math.max(1, Math.min(terminalColumns - indent, MAX_IMAGE_COLUMNS));
}

export function fitImage(
  pixels: { readonly width: number; readonly height: number },
  options: FitOptions,
): CellSize {
  const width = Math.max(1, pixels.width);
  const height = Math.max(1, pixels.height);
  const columnLimit = Math.max(
    1,
    options.upscale
      ? options.maxColumns
      : Math.min(
          options.maxColumns,
          Math.ceil(width / options.pixelsPerColumn),
        ),
  );
  const rowLimit = Math.max(
    1,
    options.upscale
      ? options.maxRows
      : Math.min(options.maxRows, Math.ceil(height / options.pixelsPerRow)),
  );
  const rowsPerColumn = height / width / 2;
  let columns = columnLimit;
  let rows = columns * rowsPerColumn;
  if (rows > rowLimit) {
    rows = rowLimit;
    columns = rows / rowsPerColumn;
  }
  return {
    columns: Math.min(columnLimit, Math.max(1, Math.round(columns))),
    rows: Math.min(rowLimit, Math.max(1, Math.round(rows))),
  };
}
