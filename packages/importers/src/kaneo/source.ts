import { SourceHttpError } from "../http.js";
import type { ConnectOptions, ImportSource, SourceProject } from "../types.js";
import {
  createKaneoClient,
  type KaneoClient,
  type KaneoWorkspace,
} from "./client.js";
import { readKaneoProject } from "./read-project.js";
import { normalizeKaneoUrl } from "./url.js";

export type KaneoCredentials = {
  url: string;
  apiKey: string;
};

export async function connectKaneo(
  credentials: KaneoCredentials,
  options: ConnectOptions = {},
): Promise<ImportSource> {
  if (!credentials.url?.trim()) {
    throw new Error("Enter the URL of the Kaneo instance to import from.");
  }
  const apiKey = credentials.apiKey?.trim();
  if (!apiKey) {
    throw new Error("Enter an API key from the Kaneo instance to import from.");
  }

  const baseUrl = normalizeKaneoUrl(credentials.url);
  const clientFor = (signal?: AbortSignal) =>
    createKaneoClient({ baseUrl, apiKey, fetch: options.fetch, signal });

  const workspaces = await clientFor(options.signal).listWorkspaces();

  return {
    listProjects() {
      return listKaneoProjects(clientFor(options.signal), workspaces);
    },
    readProject(projectId, readOptions) {
      return readKaneoProject(
        clientFor(readOptions.signal ?? options.signal),
        projectId,
        readOptions,
      );
    },
  };
}

export async function listKaneoProjects(
  client: KaneoClient,
  workspaces: KaneoWorkspace[],
): Promise<SourceProject[]> {
  const projects: SourceProject[] = [];
  for (const workspace of workspaces) {
    let found;
    try {
      found = await client.listProjects(workspace.id);
    } catch (error) {
      if (
        error instanceof SourceHttpError &&
        (error.status === 403 || error.status === 404)
      ) {
        continue;
      }
      throw error;
    }
    for (const project of found) {
      projects.push({
        id: project.id,
        name: project.name,
        detail: project.archivedAt
          ? `${workspace.name} (archived)`
          : workspace.name,
      });
    }
  }
  return projects;
}
