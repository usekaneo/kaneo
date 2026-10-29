import semver from "semver";

export function isValidRange(range) {
  if (typeof range !== "string") return false;
  if (range.split("||").some((set) => !set.trim())) return false;
  return semver.validRange(range) !== null;
}
