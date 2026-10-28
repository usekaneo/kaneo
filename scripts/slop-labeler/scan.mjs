import { addedLines } from "./changed-lines.mjs";
import { changedComments } from "./extract-comments.mjs";
import { scoreComment } from "./classify.mjs";
import { policy, supportedFile } from "./policy.mjs";

export async function scanFiles(files, readSource, score = scoreComment) {
  const candidates = files.filter(
    (file) =>
      file.status !== "removed" &&
      file.additions > 0 &&
      supportedFile(file.filename),
  );
  if (candidates.length > policy.maxFiles) {
    throw new Error("Too many changed source files for a complete scan.");
  }

  const seen = new Set();
  const matches = [];
  let bytes = 0;
  for (const file of candidates) {
    const lines = addedLines(file);
    const source = await readSource(file);
    const size = Buffer.byteLength(source, "utf8");
    bytes += size;
    if (size > policy.maxFileBytes || bytes > policy.maxTotalBytes) {
      throw new Error("Changed source content exceeded the scan limit.");
    }
    if (
      /@generated|automatically generated|auto-generated/i.test(
        source.slice(0, 1000),
      )
    ) {
      continue;
    }
    for (const comment of changedComments(source, file.filename, lines)) {
      const result = score(comment.text, file.filename);
      if (seen.has(result.prose)) continue;
      seen.add(result.prose);
      if (result.score !== null && result.score >= policy.threshold) {
        matches.push({ file: file.filename, line: comment.line });
      }
    }
  }
  return { flagged: matches.length >= policy.minMatches, matches };
}
