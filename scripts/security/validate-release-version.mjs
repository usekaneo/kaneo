import { readFileSync } from "node:fs";

const version = process.argv[2];
const expected = JSON.parse(readFileSync("package.json", "utf8")).version;
// Only a single SemVer value is accepted, before any output-file or shell use.
const semver =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;
if (!version || version.length > 128 || semver.exec(version)?.[0] !== version) {
  throw new Error("Release version must be a single valid SemVer value");
}
if (process.argv[3] !== "--new-version" && version !== expected) {
  throw new Error(
    "Release version must match package.json in the checked-out commit",
  );
}
