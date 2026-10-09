export type Picture = {
  readonly lines: ReadonlyArray<string>;
  readonly columns: number;
};

export function besidePicture(
  picture: Picture,
  text: ReadonlyArray<string>,
  options: { readonly indent: number; readonly gap: number },
): string[] {
  const offset = Math.max(
    0,
    Math.floor((picture.lines.length - text.length) / 2),
  );
  const height = Math.max(picture.lines.length, offset + text.length);
  const pad = " ".repeat(options.indent);
  const empty = " ".repeat(picture.columns);
  const gap = " ".repeat(options.gap);
  return Array.from({ length: height }, (_, row) => {
    const art = picture.lines[row] ?? empty;
    const words = text[row - offset] ?? "";
    return words === "" ? `${pad}${art}` : `${pad}${art}${gap}${words}`;
  });
}
