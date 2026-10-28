import { SourceHttpError } from "../http.js";
import type {
  ConnectOptions,
  FetchLike,
  ImportedProject,
  ImportSource,
  ReadProjectOptions,
  SourceProject,
} from "../types.js";
import { type PlaneComment, PlaneClient, type PlaneProject } from "./client.js";
import { mapPlaneProject, uniqueById } from "./mapping.js";
import { createPacedFetch } from "./pacing.js";
import { parsePlaneUrl } from "./url.js";

export type PlaneCredentials = {
  url: string;
  apiKey: string;
  workspaceSlug?: string;
};

export const REJECTED_KEY_MESSAGE =
  "Plane rejected the API key. Create a personal access token under Profile settings > Developer > Personal Access Tokens.";

const COMMENT_PROGRESS_STEP = 10;

export async function connectPlane(
  credentials: PlaneCredentials,
  options: ConnectOptions = {},
): Promise<ImportSource> {
  const apiKey = credentials.apiKey?.trim();
  if (!apiKey) {
    throw new Error(
      "Add a Plane personal access token from Profile settings > Developer > Personal Access Tokens.",
    );
  }
  const target = parsePlaneUrl(credentials.url, credentials.workspaceSlug);
  const baseFetch: FetchLike =
    options.fetch ?? ((input, init) => fetch(input, init));
  const client = new PlaneClient({
    baseUrl: target.apiBaseUrl,
    apiKey,
    workspaceSlug: target.workspaceSlug,
    fetch: createPacedFetch(baseFetch),
    signal: options.signal,
  });

  await verifyToken(client);
  let pending: PlaneProject[] | null = await verifyWorkspace(client);
  const projectsById = new Map(pending.map((project) => [project.id, project]));

  return {
    async listProjects(): Promise<SourceProject[]> {
      const projects = pending ?? (await client.listProjects());
      pending = null;
      for (const project of projects) projectsById.set(project.id, project);
      return projects
        .filter((project) => !project.archived_at)
        .map((project) => ({
          id: project.id,
          name: project.name,
          ...(project.identifier ? { detail: project.identifier } : {}),
        }));
    },

    readProject(projectId, readOptions) {
      return readPlaneProject(
        client.withSignal(readOptions.signal),
        projectId,
        projectsById.get(projectId),
        readOptions,
      );
    },
  };
}

async function verifyToken(client: PlaneClient): Promise<void> {
  let user: Awaited<ReturnType<PlaneClient["me"]>>;
  try {
    user = await client.me();
  } catch (error) {
    if (error instanceof SourceHttpError) {
      if (error.status === 401 || error.status === 403) {
        throw new Error(REJECTED_KEY_MESSAGE);
      }
      if (error.status === 404) throw notPlaneError();
    }
    throw error;
  }
  if (!user || typeof user !== "object" || typeof user.id !== "string") {
    throw notPlaneError();
  }
}

async function verifyWorkspace(client: PlaneClient): Promise<PlaneProject[]> {
  try {
    return await client.listProjects();
  } catch (error) {
    if (error instanceof SourceHttpError) {
      if (error.status === 401) throw new Error(REJECTED_KEY_MESSAGE);
      if (error.status === 403 || error.status === 404) {
        throw new Error(
          `Plane could not find the workspace "${client.workspaceSlug}" for this token.`,
        );
      }
    }
    throw error;
  }
}

function notPlaneError(): Error {
  return new Error(
    "This address does not look like a Plane server. Check the workspace URL.",
  );
}

async function readPlaneProject(
  client: PlaneClient,
  projectId: string,
  known: PlaneProject | undefined,
  options: ReadProjectOptions,
): Promise<ImportedProject> {
  const { onProgress } = options;
  onProgress?.("Reading states, labels and members");
  const project = known ?? (await client.getProject(projectId));
  const states = await client.listStates(projectId);
  const labels = await client.listLabels(projectId);
  const members = await unlessStatus(client.listMembers(projectId), [403, 404]);

  const listed = await client.listWorkItems(projectId, {
    expandAssignees: members === null,
    onPage: (loaded, total) =>
      onProgress?.(
        total === undefined
          ? `Reading work items (${loaded})`
          : `Reading work items (${loaded} of ${total})`,
      ),
  });
  const workItems = uniqueById(listed);

  const comments = new Map<string, PlaneComment[]>();
  if (options.includeComments) {
    const total = workItems.length;
    for (const [index, item] of workItems.entries()) {
      const itemComments = await unlessStatus(
        client.listComments(projectId, item.id),
        [404],
      );
      comments.set(item.id, itemComments ?? []);
      const done = index + 1;
      if (done % COMMENT_PROGRESS_STEP === 0 || done === total) {
        onProgress?.(`Reading comments (${done} of ${total})`);
      }
    }
  }

  return mapPlaneProject({
    project,
    states,
    labels,
    members,
    workItems,
    comments,
  });
}

async function unlessStatus<T>(
  request: Promise<T>,
  statuses: number[],
): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof SourceHttpError && statuses.includes(error.status)) {
      return null;
    }
    throw error;
  }
}
