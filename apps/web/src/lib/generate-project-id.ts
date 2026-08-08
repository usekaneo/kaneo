// Slug rules follow the API's `toSlug` (apps/api/src/column/controllers/
// create-column.ts): letters, marks and numbers from any script, matched with
// Unicode property escapes rather than A-Z, so a project named in Cyrillic,
// Greek or Han gets a key instead of an empty string.
function generateProjectSlug(projectName: string) {
  const words = projectName
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, "")
    .split(/\s+/)
    // Splitting leaves an empty first entry when the name starts with a
    // separator, and stripping punctuation can leave a word of combining
    // marks alone. Either one would take a slot and cost an initial.
    .filter((word) => /[\p{L}\p{N}]/u.test(word));

  if (words.length === 0) {
    return "";
  }

  // Iterate by code point, not by UTF-16 unit. A letter outside the basic
  // multilingual plane is two units, so `word[0]` would hand back half a
  // surrogate pair and `slice(0, 3)` would cut one in half.
  if (words.length === 1) {
    return Array.from(words[0]).slice(0, 3).join("");
  }

  return words.slice(0, 3).map(firstLetterOrNumber).join("");
}

// Stripping punctuation can leave a word whose first code point is a combining
// mark, which is not an initial anyone would recognize.
function firstLetterOrNumber(word: string): string {
  for (const char of word) {
    if (/[\p{L}\p{N}]/u.test(char)) {
      return char;
    }
  }

  return "";
}

export default generateProjectSlug;
