import { posix } from "node:path";
import { parseAllDocuments } from "yaml";
import {
  dependencyKey,
  packageIdentity,
} from "./dependency-graph-identity.mjs";

const groups = ["dependencies", "optionalDependencies", "devDependencies"];

function mapping(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected a mapping: ${label}`);
  }
  return value;
}

function dependencyGroup(owner, group) {
  return mapping(Object.hasOwn(owner, group) ? owner[group] : {}, group);
}

function mainDocument(source) {
  const documents = parseAllDocuments(source);
  const candidates = [];
  for (const document of documents) {
    if (document.errors.length) throw new Error(document.errors[0].message);
    const lock = mapping(
      document.toJS({ maxAliasCount: 100 }),
      "lock document",
    );
    if (lock.lockfileVersion !== "9.0")
      throw new Error("Expected pnpm lockfile version 9.0");
    const importers = Object.values(mapping(lock.importers, "importers"));
    if (!importers.length) throw new Error("Empty importers");
    for (const importer of importers) mapping(importer, "importer");
    const application = importers.some((importer) =>
      groups.some((group) => group in importer),
    );
    const environment = importers.some(
      (importer) =>
        "configDependencies" in importer ||
        "packageManagerDependencies" in importer,
    );
    if (application && !environment) candidates.push(lock);
    else if (!environment || application)
      throw new Error("Unrecognized or mixed lock document");
  }
  if (candidates.length !== 1)
    throw new Error("Expected exactly one application lock document");
  return candidates[0];
}

export function buildManifest(source, path) {
  const lock = mainDocument(source);
  const packages = mapping(lock.packages, "packages");
  const snapshots = mapping(lock.snapshots, "snapshots");
  if (!Object.keys(packages).length || !Object.keys(snapshots).length) {
    throw new Error(`Empty application graph: ${path}`);
  }

  const resolved = new Map();
  const packageBases = new Set();
  for (const [key, value] of Object.entries(packages)) {
    mapping(value, key);
    const { base, purl } = packageIdentity(key);
    packageBases.add(base);
    resolved.set(purl, { package_url: purl, dependencies: new Set() });
  }

  const identities = new Map();
  const covered = new Set();
  for (const [key, value] of Object.entries(snapshots)) {
    mapping(value, key);
    const { base, purl } = packageIdentity(key);
    if (!packageBases.has(base))
      throw new Error(`Snapshot missing package: ${key}`);
    covered.add(base);
    identities.set(key, purl);
  }
  for (const base of packageBases) {
    if (!covered.has(base))
      throw new Error(`Package missing snapshot: ${base}`);
  }

  function resolve(name, reference) {
    const key = dependencyKey(name, reference);
    if (!identities.has(key)) {
      throw new Error(`Unresolved dependency: ${name} -> ${reference}`);
    }
    return key;
  }

  const edges = new Map();
  for (const [key, snapshot] of Object.entries(snapshots)) {
    const children = new Set();
    // pnpm lists resolved peers here too. transitivePeerDependencies contains
    // names without versions, so it cannot establish additional resolved edges.
    for (const group of ["dependencies", "optionalDependencies"]) {
      const references = dependencyGroup(snapshot, group);
      for (const [name, reference] of Object.entries(references)) {
        const child = resolve(name, reference);
        children.add(child);
        resolved
          .get(identities.get(key))
          .dependencies.add(identities.get(child));
      }
    }
    edges.set(key, children);
  }

  const direct = new Set();
  const runtimeRoots = [];
  const developmentRoots = [];
  for (const [importerPath, importer] of Object.entries(lock.importers)) {
    for (const group of groups) {
      for (const [name, value] of Object.entries(
        dependencyGroup(importer, group),
      )) {
        const { version } = mapping(value, name);
        if (typeof version === "string" && version.startsWith("link:")) {
          const target = posix.normalize(
            posix.join(importerPath, version.slice(5)),
          );
          if (!Object.hasOwn(lock.importers, target)) {
            throw new Error(`Missing workspace importer: ${target}`);
          }
          // Every workspace importer is processed; local links have no npm PURL.
          continue;
        }
        const key = resolve(name, version);
        direct.add(identities.get(key));
        (group === "devDependencies" ? developmentRoots : runtimeRoots).push(
          key,
        );
      }
    }
  }
  if (!direct.size) throw new Error(`No direct npm dependencies: ${path}`);

  function reachable(roots) {
    const seen = new Set();
    const queue = [...roots];
    while (queue.length) {
      const key = queue.pop();
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(...edges.get(key));
    }
    return new Set([...seen].map((key) => identities.get(key)));
  }
  const runtime = reachable(runtimeRoots);
  const development = reachable(developmentRoots);

  return {
    name: path,
    file: { source_location: path },
    resolved: Object.fromEntries(
      [...resolved]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([purl, entry]) => {
          // Unreachable entries remain, without an invented scope/relationship.
          const relationship = direct.has(purl)
            ? "direct"
            : runtime.has(purl) || development.has(purl)
              ? "indirect"
              : undefined;
          const scope = runtime.has(purl)
            ? "runtime"
            : development.has(purl)
              ? "development"
              : undefined;
          return [
            purl,
            {
              package_url: entry.package_url,
              ...(relationship && { relationship }),
              ...(scope && { scope }),
              dependencies: [...entry.dependencies].sort(),
            },
          ];
        }),
    ),
  };
}
