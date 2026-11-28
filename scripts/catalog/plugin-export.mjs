function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readExport(target) {
  if (typeof target === "string") return target || null;
  if (!isRecord(target)) return null;
  for (const condition of ["import", "default"]) {
    const value = readExport(target[condition]);
    if (value) return value;
  }
  return null;
}

export function isInsidePackage(path) {
  const normalized = path.replace(/\\/g, "/");
  return normalized.startsWith("./") && !normalized.split("/").includes("..");
}
