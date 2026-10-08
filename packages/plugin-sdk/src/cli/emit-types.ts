import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { isBuiltin } from "node:module";
import { dirname, join, relative, sep } from "node:path";
import { readDeclarationGraph } from "./declaration-graph.js";
import type { PluginEntries } from "./entries.js";
import { CliError } from "./errors.js";
import { renderInlineDeclaration } from "./inline-declaration.js";
import { log } from "./log.js";
import { declaredPackages } from "./manifest.js";
import type { PackageJson } from "./manifest.js";
import { findModuleSpecifiers, packageNameOf } from "./module-specifiers.js";
import { resolveTsc, runTsc } from "./run-tsc.js";
import { createTypeProbe, readProbedTypes } from "./type-probe.js";
import { createTypesConfig } from "./types-config.js";

const MISSING_TYPESCRIPT =
  "typescript is not installed in this plugin, so dist/index.d.ts was not generated. Add it to devDependencies so kaneo.config.ts can type-check the plugin's options.";

const FACTORY_HINT =
  "src/index.ts must default-export the factory returned by definePlugin(import.meta.url, { ... }).";

function toImportSpecifier(fromDir: string, file: string): string {
  const path = relative(fromDir, file)
    .split(sep)
    .join("/")
    .replace(/\.tsx?$/, ".js");
  return path.startsWith(".") ? path : `./${path}`;
}

function declarationPath(outDir: string, root: string, source: string) {
  return join(outDir, relative(root, source)).replace(/\.tsx?$/, ".d.ts");
}

async function copyDeclarations(files: string[], from: string, to: string) {
  for (const file of files) {
    const target = join(to, relative(from, file));
    await mkdir(dirname(target), { recursive: true });
    await copyFile(file, target);
  }
}

function undeclaredPackages(code: string, allowed: Set<string>): string[] {
  return findModuleSpecifiers(code)
    .filter((specifier) => !isBuiltin(specifier))
    .map(packageNameOf)
    .filter((name) => !allowed.has(name));
}

export async function emitTypes(
  root: string,
  entries: PluginEntries,
  packageJson: PackageJson,
): Promise<boolean> {
  const tsc = resolveTsc(root);
  if (!tsc) {
    log.warn(MISSING_TYPESCRIPT);
    return false;
  }

  const dist = join(root, "dist");
  const workDir = join(dist, ".kaneo-types");
  const outDir = join(workDir, "out");
  const probe = join(workDir, "probe.ts");
  const project = join(workDir, "tsconfig.json");
  await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });

  try {
    await writeFile(
      probe,
      createTypeProbe(toImportSpecifier(workDir, entries.index)),
    );
    await writeFile(
      project,
      JSON.stringify(
        createTypesConfig({ root, files: [entries.index, probe], outDir }),
        null,
        2,
      ),
    );

    const result = runTsc(tsc, project, root);
    if (!result.ok) {
      const hint = result.output.includes("probe.ts")
        ? `\n${FACTORY_HINT}`
        : "";
      throw new CliError(
        `TypeScript could not generate dist/index.d.ts:\n${result.output}${hint}`,
      );
    }

    const allowed = declaredPackages(packageJson);
    const emittedIndex = declarationPath(outDir, root, entries.index);
    const graph = await readDeclarationGraph(
      emittedIndex,
      dirname(emittedIndex),
    );
    const undeclared = graph.packages.filter((name) => !allowed.has(name));
    if (graph.contained && undeclared.length === 0) {
      await copyDeclarations(graph.files, dirname(emittedIndex), dist);
      return true;
    }

    const probed = readProbedTypes(
      await readFile(declarationPath(outDir, root, probe), "utf8"),
    );
    if (!probed) {
      throw new CliError(
        `Could not read the plugin's options type from TypeScript's output. ${FACTORY_HINT}`,
      );
    }
    const declaration = renderInlineDeclaration(probed);
    const leftovers = undeclaredPackages(declaration, allowed);
    if (leftovers.length > 0) {
      log.warn(
        `The options type in dist/index.d.ts still refers to ${leftovers.join(", ")}, which the plugin does not list in dependencies. Describe options with plain types so operators get type checking.`,
      );
    }
    await writeFile(join(dist, "index.d.ts"), declaration);
    if (undeclared.length > 0) {
      log.step(
        `Inlined the options type into dist/index.d.ts instead of importing ${undeclared.join(", ")}`,
      );
    }
    return true;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
