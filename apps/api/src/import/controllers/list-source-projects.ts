import type { ImportConnectionInput } from "../schema";
import {
  importHttpError,
  openImportSource,
} from "../source/open-import-source";

const LIST_TIMEOUT_MS = 90_000;

async function listSourceProjects(connection: ImportConnectionInput) {
  const opened = await openImportSource(
    connection,
    AbortSignal.timeout(LIST_TIMEOUT_MS),
  );

  try {
    const projects = await opened.source.listProjects();
    return {
      projects: projects.map(({ id, name, detail }) => ({
        id,
        name,
        ...(detail ? { detail } : {}),
      })),
    };
  } catch (error) {
    throw importHttpError(opened.describe(error));
  }
}

export default listSourceProjects;
