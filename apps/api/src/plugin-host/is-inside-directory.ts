import { isAbsolute, relative, sep } from "node:path";

export function isInsideDirectory(directory: string, path: string): boolean {
  const rel = relative(directory, path);
  return (
    rel !== "" &&
    rel !== ".." &&
    !rel.startsWith(`..${sep}`) &&
    !isAbsolute(rel)
  );
}
