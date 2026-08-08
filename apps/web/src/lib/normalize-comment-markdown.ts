function normalizeSpaces(markdown: string) {
  return markdown.replace(/&nbsp;/g, " ").replace(/\u00A0/g, " ");
}

function findClosingBacktickRun(
  markdown: string,
  start: number,
  delimiterLength: number,
) {
  let index = start;

  while (index < markdown.length) {
    if (markdown[index] !== "`") {
      index += 1;
      continue;
    }

    let runLength = 1;
    while (markdown[index + runLength] === "`") {
      runLength += 1;
    }

    if (runLength === delimiterLength) return index;
    index += runLength;
  }

  return -1;
}

function normalizeInlineMarkdown(markdown: string) {
  let output = "";
  let textStart = 0;
  let index = 0;

  while (index < markdown.length) {
    if (markdown[index] !== "`") {
      index += 1;
      continue;
    }

    let delimiterLength = 1;
    while (markdown[index + delimiterLength] === "`") {
      delimiterLength += 1;
    }

    const closingIndex = findClosingBacktickRun(
      markdown,
      index + delimiterLength,
      delimiterLength,
    );
    if (closingIndex === -1) {
      index += delimiterLength;
      continue;
    }

    output += normalizeSpaces(markdown.slice(textStart, index));
    output += markdown.slice(index, closingIndex + delimiterLength);
    index = closingIndex + delimiterLength;
    textStart = index;
  }

  return output + normalizeSpaces(markdown.slice(textStart));
}

export function normalizeCommentMarkdown(markdown: string) {
  const normalizedNewlines = markdown.replace(/\r\n/g, "\n");
  const lines = normalizedNewlines.match(/[^\n]*(?:\n|$)/g) ?? [];
  let fence: { marker: string; length: number } | null = null;

  return lines
    .map((lineWithEnding) => {
      const line = lineWithEnding.endsWith("\n")
        ? lineWithEnding.slice(0, -1)
        : lineWithEnding;

      if (fence) {
        const closingFence = /^ {0,3}(`{3,}|~{3,})[\t ]*$/.exec(line);
        if (
          closingFence &&
          closingFence[1][0] === fence.marker &&
          closingFence[1].length >= fence.length
        ) {
          fence = null;
        }
        return lineWithEnding;
      }

      const openingFence = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (
        openingFence &&
        (openingFence[1][0] === "~" || !openingFence[2].includes("`"))
      ) {
        fence = {
          marker: openingFence[1][0],
          length: openingFence[1].length,
        };
        return lineWithEnding;
      }

      return normalizeInlineMarkdown(lineWithEnding);
    })
    .join("");
}
