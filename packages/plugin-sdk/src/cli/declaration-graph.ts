import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isBuiltin } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import {
  findModuleSpecifiers,
  isRelativeSpecifier,
  isUrlSpecifier,
  packageNameOf,
} from "./module-specifiers.js";

export type DeclarationGraph = {
  files: string[];
  packages: string[];
  contained: boolean;
};

function declarationCandidates(path: string): string[] {
  if (path.endsWith(".js")) return [path.replace(/\.js$/, ".d.ts")];
  if (path.endsWith(".mjs")) return [path.replace(/\.mjs$/, ".d.mts")];
  return [`${path}.d.ts`, join(path, "index.d.ts")];
}

function isInside(baseDir: string, path: string): boolean {
  const relativePath = relative(baseDir, path);
  return !relativePath.startsWith("..") && !relativePath.startsWith("/");
}

export async function readDeclarationGraph(
  entry: string,
  baseDir: string,
): Promise<DeclarationGraph> {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [entry];
  let contained = true;

  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (files.has(file)) continue;
    files.add(file);
    const source = await readFile(file, "utf8");
    for (const specifier of findModuleSpecifiers(source)) {
      if (isUrlSpecifier(specifier) || isBuiltin(specifier)) continue;
      if (!isRelativeSpecifier(specifier)) {
        packages.add(packageNameOf(specifier));
        continue;
      }
      const target = declarationCandidates(
        resolve(dirname(file), specifier),
      ).find((candidate) => existsSync(candidate));
      if (!target || !isInside(baseDir, target)) contained = false;
      else queue.push(target);
    }
  }

  return { files: [...files], packages: [...packages], contained };
}
