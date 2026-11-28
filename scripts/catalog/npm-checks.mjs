import { isInsidePackage, readExport } from "./plugin-export.mjs";
import { isValidRange } from "./semver-range.mjs";

const INSTALL_SCRIPTS = ["preinstall", "install", "postinstall"];

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readNpmView(stdout, fallbackError = "npm view failed") {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return { error: fallbackError };
  }
  if (Array.isArray(parsed)) parsed = parsed.at(-1);
  if (!isRecord(parsed)) return { error: fallbackError };
  if (isRecord(parsed.error)) {
    if (parsed.error.code === "E404") return { notFound: true };
    return { error: String(parsed.error.summary ?? fallbackError) };
  }
  return { manifest: parsed };
}

export function hasProvenance(manifest) {
  return (
    isRecord(manifest.dist) &&
    isRecord(manifest.dist.attestations) &&
    isRecord(manifest.dist.attestations.provenance)
  );
}

export function checkPublishedPackage(entry, manifest) {
  const errors = [];
  const warnings = [];

  const keywords = Array.isArray(manifest.keywords) ? manifest.keywords : [];
  if (!keywords.includes("kaneo-plugin")) {
    errors.push('"keywords" does not include "kaneo-plugin"');
  }

  const engines = isRecord(manifest.engines) ? manifest.engines.kaneo : null;
  if (typeof engines !== "string") {
    errors.push('"engines.kaneo" is not declared');
  } else if (!isValidRange(engines)) {
    errors.push(`"engines.kaneo" is "${engines}", which is not a semver range`);
  } else if (engines !== entry.kaneo) {
    warnings.push(
      `"engines.kaneo" is "${engines}" but the catalog lists "${entry.kaneo}"`,
    );
  }

  const exportsField = isRecord(manifest.exports) ? manifest.exports : {};
  const entries = [
    ["./server", readExport(exportsField["./server"])],
    ["./web", readExport(exportsField["./web"])],
  ];
  if (entries.every(([, target]) => !target)) {
    errors.push('"exports" has no usable "./server" or "./web" entry');
  }
  for (const [key, target] of entries) {
    if (target && !isInsidePackage(target)) {
      errors.push(`Export "${key}" must point to a file inside the package`);
    }
  }

  const scripts = isRecord(manifest.scripts) ? manifest.scripts : {};
  const installScripts = INSTALL_SCRIPTS.filter((name) => name in scripts);
  if (installScripts.length > 0) {
    errors.push(`has install scripts: ${installScripts.join(", ")}`);
  }

  if (!hasProvenance(manifest)) {
    warnings.push("was published without npm provenance");
  }

  return { errors, warnings };
}
