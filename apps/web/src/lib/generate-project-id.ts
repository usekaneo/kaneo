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

  if (words.length === 1) {
    return words[0].slice(0, 3);
  }

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("");
}

export default generateProjectSlug;
