const configName =
  /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|pnpm-workspace\.yaml|turbo\.json|vite\.config\.[^/]+|next\.config\.[^/]+|tsconfig[^/]*\.json|Dockerfile(?:\.[^/]*)?|docker-compose[^/]*\.ya?ml|Makefile|.*\.config\.[^/]+|.*\.ya?ml|.*\.toml|.*\.json|.*\.lock)$/i;

export function isRuntimeNeutralPath(path) {
  if (
    typeof path !== "string" ||
    !path ||
    path.startsWith("/") ||
    path.split("/").includes("..")
  )
    return false;
  if (path.split("/").some((segment) => segment.startsWith("."))) return false;
  if (configName.test(path) && path !== "apps/site/constants/sponsors.json")
    return false;
  return (
    path === "README.md" || /^(docs|apps\/docs|apps\/site)\/[^/].*$/.test(path)
  );
}

export function areRuntimeNeutralFiles(files) {
  if (!Array.isArray(files) || files.length === 0) return false;
  for (const file of files) {
    if (typeof file === "string") {
      if (!isRuntimeNeutralPath(file)) return false;
      continue;
    }
    if (
      !file ||
      typeof file !== "object" ||
      !isRuntimeNeutralPath(file.filename)
    )
      return false;
    if (!new Set(["added", "modified", "removed", "renamed"]).has(file.status))
      return false;
    if (
      file.status === "renamed" &&
      !isRuntimeNeutralPath(file.previous_filename)
    )
      return false;
    if (
      file.previous_filename !== undefined &&
      !isRuntimeNeutralPath(file.previous_filename)
    )
      return false;
    if (file.status === "renamed" && typeof file.previous_filename !== "string")
      return false;
  }
  return true;
}
