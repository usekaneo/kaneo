import type { RequiredOperation } from "./required-operations.js";

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "trace",
]);

export function operationKey(method: string, path: string): string {
  const relative = path
    .replace(/^\/api(?=\/|$)/, "")
    .replace(/\{[^}]*\}/g, "{}")
    .replace(/\/:[^/]+/g, "/{}")
    .replace(/\/+$/, "");
  return `${method.toUpperCase()} ${relative || "/"}`;
}

export function documentedOperations(
  document: unknown,
): ReadonlySet<string> | undefined {
  const paths = (document as { paths?: unknown } | null)?.paths;
  if (typeof paths !== "object" || paths === null) return undefined;
  const operations = new Set<string>();
  for (const [path, item] of Object.entries(paths)) {
    if (typeof item !== "object" || item === null) continue;
    for (const method of Object.keys(item)) {
      if (HTTP_METHODS.has(method.toLowerCase())) {
        operations.add(operationKey(method, path));
      }
    }
  }
  return operations;
}

export function missingOperations(
  required: ReadonlyArray<RequiredOperation>,
  document: unknown,
): ReadonlyArray<RequiredOperation> | undefined {
  const available = documentedOperations(document);
  if (!available) return undefined;
  return required.filter(
    (operation) =>
      !available.has(operationKey(operation.method, operation.path)),
  );
}
