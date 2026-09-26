function normalizeSpaces(markdown: string) {
  return markdown.replace(/&nbsp;/g, " ").replace(/\u00A0/g, " ");
}

function normalizeInlineMarkdown(markdown: string) {
  const runs = Array.from(markdown.matchAll(/`+/g), (match) => ({
    index: match.index,
    length: match[0].length,
    next: -1,
  }));
  // Index matching delimiters once. Restarting a suffix scan for each unmatched
  // run makes descending run lengths quadratic in the number of delimiters.
  const nextByLength = new Map<number, number>();
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    const run = runs[index];
    run.next = nextByLength.get(run.length) ?? -1;
    nextByLength.set(run.length, index);
  }

  const output: string[] = [];
  let textStart = 0;
  for (let index = 0; index < runs.length; index += 1) {
    const opening = runs[index];
    if (opening.next === -1) continue;
    const closing = runs[opening.next];
    output.push(normalizeSpaces(markdown.slice(textStart, opening.index)));
    textStart = closing.index + closing.length;
    output.push(markdown.slice(opening.index, textStart));
    index = opening.next;
  }
  output.push(normalizeSpaces(markdown.slice(textStart)));
  return output.join("");
}

export function normalizeCommentMarkdown(markdown: string) {
  const normalizedNewlines = markdown.replace(/\r\n/g, "\n");
  const lines = normalizedNewlines.match(/[^\n]*(?:\n|$)/g) ?? [];
  let fence: { marker: string; length: number } | null = null;
  let textSegment = "";
  let output = "";

  for (const lineWithEnding of lines) {
    const line = lineWithEnding.endsWith("\n")
      ? lineWithEnding.slice(0, -1)
      : lineWithEnding;

    if (fence) {
      output += lineWithEnding;
      const closingFence = /^ {0,3}(`{3,}|~{3,})[\t ]*$/.exec(line);
      if (
        closingFence &&
        closingFence[1][0] === fence.marker &&
        closingFence[1].length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }

    const openingFence = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (
      openingFence &&
      (openingFence[1][0] === "~" || !openingFence[2].includes("`"))
    ) {
      output += normalizeInlineMarkdown(textSegment);
      textSegment = "";
      fence = {
        marker: openingFence[1][0],
        length: openingFence[1].length,
      };
      output += lineWithEnding;
      continue;
    }

    textSegment += lineWithEnding;
  }

  return output + normalizeInlineMarkdown(textSegment);
}
