import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { errorMessage } from "@kaneo/plugin-loader";

export const NEW_PROJECT_PACKAGE = {
  name: "kaneo-instance",
  private: true,
  type: "module",
};

export type ProjectPackage = {
  readonly created: boolean;
  readonly hasConfigPackage: boolean;
};

async function readPackageJson(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function ensureProjectPackage(
  projectDir: string,
): Promise<ProjectPackage> {
  const path = join(projectDir, "package.json");
  const raw = await readPackageJson(path);
  if (raw === null) {
    await writeFile(path, `${JSON.stringify(NEW_PROJECT_PACKAGE, null, 2)}\n`);
    return { created: true, hasConfigPackage: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${errorMessage(error)}`);
  }
  const dependencies =
    typeof parsed === "object" && parsed !== null
      ? (parsed as { dependencies?: unknown }).dependencies
      : undefined;
  return {
    created: false,
    hasConfigPackage:
      typeof dependencies === "object" &&
      dependencies !== null &&
      "@kaneo/config" in dependencies,
  };
}
