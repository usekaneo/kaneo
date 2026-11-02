export function normalizeLabel(label: string) {
  return label.normalize("NFC").replace(/\s+/g, " ").trim();
}

// Cleans pasted names: trims, drops blanks, and removes repeats ignoring case
// (the first spelling wins). `repeated` lists what was dropped as a repeat.
export function normalizeLabels(labels: readonly string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  const repeated: string[] = [];
  for (const raw of labels) {
    const label = normalizeLabel(raw);
    if (!label) continue;
    const folded = label.toLowerCase();
    if (seen.has(folded)) {
      repeated.push(label);
      continue;
    }
    seen.add(folded);
    unique.push(label);
  }
  return { labels: unique, repeated };
}
