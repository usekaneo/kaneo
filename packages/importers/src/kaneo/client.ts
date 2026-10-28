import { createJsonClient, SourceHttpError } from "../http.js";
import type { FetchLike } from "../types.js";

export type KaneoWorkspace = {
  id: string;
  name: string;
};

export type KaneoProject = {
  id: string;
  name: string;
  archivedAt?: string | null;
};

export type KaneoLabel = {
  id?: string;
  name: string;
  color: string | null;
};

export type KaneoExternalLink = {
  id: string;
};

export type KaneoBoardTask = {
  id: string;
  title: string;
  number: number | null;
  description: string | null;
  descriptionDeferred?: boolean;
  status: string;
  priority: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  position: number | null;
  createdAt?: string | null;
  userId: string | null;
  assigneeName?: string | null;
  labels?: KaneoLabel[];
  externalLinks?: KaneoExternalLink[];
};

export type KaneoBoardColumn = {
  id: string;
  slug?: string;
  name: string;
  isFinal?: boolean;
  position?: number;
  tasks?: KaneoBoardTask[];
};

export type KaneoBoard = {
  id: string;
  name: string;
  slug?: string | null;
  description: string | null;
  descriptionDeferred?: boolean;
  workspaceId: string;
  columns: KaneoBoardColumn[];
  plannedTasks?: KaneoBoardTask[];
  archivedTasks?: KaneoBoardTask[];
};

export type KaneoBoardPagination = {
  total?: number;
  totalPages?: number;
  relatedTotalPages?: number;
};

export type KaneoBoardPage = {
  board: KaneoBoard;
  pagination: KaneoBoardPagination;
};

export type KaneoMember = {
  id: string;
  name: string;
  email: string;
};

export type KaneoActivity = {
  id: string;
  type: string;
  userId: string | null;
  content: string | null;
  createdAt: string;
  externalUserName?: string | null;
};

export type KaneoComment = {
  id: string;
  user?: { name?: string | null } | null;
};

export type KaneoRelation = {
  id?: string;
  sourceTaskId: string;
  targetTaskId: string;
  relationType: string;
};

export type KaneoCustomField = {
  id: string;
  name: string;
};

export type KaneoClientOptions = {
  baseUrl: string;
  apiKey: string;
  fetch?: FetchLike;
  signal?: AbortSignal;
};

export type KaneoClient = {
  listWorkspaces(): Promise<KaneoWorkspace[]>;
  listProjects(workspaceId: string): Promise<KaneoProject[]>;
  getBoardPage(
    projectId: string,
    page: number,
    relatedPage: number,
  ): Promise<KaneoBoardPage>;
  getProjectDescription(projectId: string): Promise<string | null>;
  getTaskDescription(taskId: string): Promise<string | null>;
  listMembers(workspaceId: string): Promise<KaneoMember[]>;
  listActivities(taskId: string): Promise<KaneoActivity[]>;
  listComments(taskId: string): Promise<KaneoComment[]>;
  listRelations(taskId: string): Promise<KaneoRelation[]>;
  listCustomFields(projectId: string): Promise<KaneoCustomField[]>;
};

export const BOARD_PAGE_SIZE = 100;

export function createKaneoClient(options: KaneoClientOptions): KaneoClient {
  const http = createJsonClient({
    service: "Kaneo",
    baseUrl: options.baseUrl,
    headers: () => ({ Authorization: `Bearer ${options.apiKey}` }),
    fetch: options.fetch,
    signal: options.signal,
    describeUnauthorized:
      "Kaneo rejected the API key (HTTP 401). Check that the key is active and was created on this instance.",
  });

  async function list<T>(path: string): Promise<T[]> {
    const body = await http.request<unknown>(path);
    if (!Array.isArray(body)) throw notKaneoError(options.baseUrl);
    return body as T[];
  }

  const id = encodeURIComponent;

  return {
    async listWorkspaces() {
      try {
        return await list<KaneoWorkspace>("/api/workspace");
      } catch (error) {
        if (!(error instanceof SourceHttpError) || error.status !== 404) {
          throw error;
        }
      }
      try {
        return await list<KaneoWorkspace>("/api/auth/organization/list");
      } catch (error) {
        if (error instanceof SourceHttpError && error.status === 404) {
          throw notKaneoError(options.baseUrl);
        }
        throw error;
      }
    },
    listProjects(workspaceId) {
      return list<KaneoProject>(
        `/api/project?workspaceId=${id(workspaceId)}&includeArchived=true`,
      );
    },
    async getBoardPage(projectId, page, relatedPage) {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(BOARD_PAGE_SIZE),
        sortBy: "position",
        sortOrder: "asc",
      });
      if (relatedPage > 1) query.set("relatedPage", String(relatedPage));
      const body = await http.request<unknown>(
        `/api/task/tasks/${id(projectId)}?${query}`,
      );
      return toBoardPage(body);
    },
    async getProjectDescription(projectId) {
      const project = await http.request<{ description?: string | null }>(
        `/api/project/${id(projectId)}`,
      );
      return project?.description ?? null;
    },
    async getTaskDescription(taskId) {
      const task = await http.request<{ description?: string | null }>(
        `/api/task/${id(taskId)}`,
      );
      return task?.description ?? null;
    },
    listMembers(workspaceId) {
      return list<KaneoMember>(`/api/workspace/${id(workspaceId)}/members`);
    },
    listActivities(taskId) {
      return list<KaneoActivity>(`/api/activity/${id(taskId)}`);
    },
    listComments(taskId) {
      return list<KaneoComment>(`/api/comment/${id(taskId)}`);
    },
    listRelations(taskId) {
      return list<KaneoRelation>(`/api/task-relation/${id(taskId)}`);
    },
    listCustomFields(projectId) {
      return list<KaneoCustomField>(
        `/api/custom-field/project/${id(projectId)}`,
      );
    },
  };
}

export function toBoardPage(body: unknown): KaneoBoardPage {
  if (isRecord(body) && isBoard(body.data)) {
    const pagination = isRecord(body.pagination)
      ? (body.pagination as KaneoBoardPagination)
      : {};
    return { board: body.data, pagination };
  }
  if (isBoard(body)) return { board: body, pagination: {} };
  throw new Error(
    "Kaneo returned an unexpected response for the project board.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoard(value: unknown): value is KaneoBoard {
  return isRecord(value) && Array.isArray(value.columns);
}

function notKaneoError(baseUrl: string): Error {
  return new Error(
    `No Kaneo API answered at ${baseUrl}. Check the instance URL; if the web app and API are hosted separately, use the API URL.`,
  );
}
