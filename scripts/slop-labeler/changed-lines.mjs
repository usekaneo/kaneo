export function addedLines(file) {
  if (!file.additions) return new Set();
  if (typeof file.patch !== "string") {
    throw new Error("GitHub did not provide a complete source patch.");
  }

  const added = new Set();
  let oldRemaining = 0;
  let newRemaining = 0;
  let line = 0;
  let additions = 0;
  let deletions = 0;
  let hunks = 0;

  for (const text of file.patch.split("\n")) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(text);
    if (header) {
      if (oldRemaining || newRemaining) {
        throw new Error("GitHub returned a truncated source patch.");
      }
      oldRemaining = Number(header[2] ?? 1);
      newRemaining = Number(header[4] ?? 1);
      line = Number(header[3]);
      hunks++;
      continue;
    }
    if (text.startsWith("\\ No newline at end of file")) continue;
    if (!text && !oldRemaining && !newRemaining) continue;
    if (!hunks) throw new Error("GitHub returned an invalid source patch.");

    if (text.startsWith("+")) {
      added.add(line++);
      additions++;
      newRemaining--;
    } else if (text.startsWith("-")) {
      deletions++;
      oldRemaining--;
    } else if (text.startsWith(" ")) {
      line++;
      oldRemaining--;
      newRemaining--;
    } else {
      throw new Error("GitHub returned an invalid source patch.");
    }
    if (oldRemaining < 0 || newRemaining < 0) {
      throw new Error("GitHub returned an invalid source patch.");
    }
  }

  if (
    oldRemaining ||
    newRemaining ||
    additions !== file.additions ||
    deletions !== file.deletions
  ) {
    throw new Error("GitHub returned a truncated source patch.");
  }
  return added;
}
