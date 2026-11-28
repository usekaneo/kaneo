export type Edit = { at: number; end?: number; text: string };

export function applyEdits(source: string, edits: readonly Edit[]): string {
  return [...edits]
    .sort((a, b) => b.at - a.at)
    .reduce(
      (result, edit) =>
        result.slice(0, edit.at) +
        edit.text +
        result.slice(edit.end ?? edit.at),
      source,
    );
}
