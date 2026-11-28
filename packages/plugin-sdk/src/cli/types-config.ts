import { existsSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_COMPILER_OPTIONS = {
  target: "ES2022",
  module: "NodeNext",
  moduleResolution: "NodeNext",
  lib: ["ES2022", "DOM"],
  jsx: "react-jsx",
  strict: true,
  esModuleInterop: true,
};

export function createTypesConfig(options: {
  root: string;
  files: string[];
  outDir: string;
}): Record<string, unknown> {
  const tsconfig = join(options.root, "tsconfig.json");
  const hasTsconfig = existsSync(tsconfig);
  return {
    ...(hasTsconfig ? { extends: tsconfig } : {}),
    compilerOptions: {
      ...(hasTsconfig ? {} : DEFAULT_COMPILER_OPTIONS),
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      declarationMap: false,
      sourceMap: false,
      outDir: options.outDir,
      declarationDir: options.outDir,
      rootDir: options.root,
      composite: false,
      incremental: false,
      isolatedDeclarations: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
      skipLibCheck: true,
    },
    files: options.files,
    include: [],
  };
}
