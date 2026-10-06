export type KaneoWorkspace = { id: string; name: string; slug?: string };
export type KaneoProject = { id: string; name: string; slug: string };
export type KaneoColumn = { id: string; name: string; slug: string };
export type KaneoTask = { id: string; title: string; number: number };
export type KaneoLabel = { id: string; name: string; color: string };
export type KaneoMember = { id: string; name: string; email: string };

const RATE_LIMIT_WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 90;
const RATE_LIMIT_SILENCE_BUFFER_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withResolvers(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  try {
    const url = new URL(trimmed);
    let path = url.pathname.replace(/\/+$/, "");
    if (path === "/api" || path.endsWith("/api")) {
      path = path.replace(/\/?api$/, "") || "/";
    }
    return `${url.protocol}//${url.host}${path === "/" ? "" : path}`;
  } catch {
    return trimmed.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  }
}

export class KaneoClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private static gate: Promise<void> = Promise.resolve();
  private static windowEndsAt = 0;
  private static sentInWindow = 0;

  constructor(options: { baseUrl: string; apiKey: string }) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey;
  }

  private async acquireSlot(): Promise<void> {
    const previous = KaneoClient.gate;
    const release = withResolvers();
    KaneoClient.gate = release.promise;
    await previous;
    if (KaneoClient.sentInWindow >= REQUESTS_PER_WINDOW) {
      const wait = KaneoClient.windowEndsAt - Date.now();
      if (wait > 0) await sleep(wait);
      KaneoClient.sentInWindow = 0;
    }
    KaneoClient.sentInWindow++;
    KaneoClient.windowEndsAt =
      Date.now() + RATE_LIMIT_WINDOW_MS + RATE_LIMIT_SILENCE_BUFFER_MS;
    release.resolve();
  }

  listWorkspaces(): Promise<KaneoWorkspace[]> {
    return this.request<KaneoWorkspace[]>("/api/auth/organization/list");
  }

  listProjects(workspaceId: string): Promise<KaneoProject[]> {
    return this.request<KaneoProject[]>(
      `/api/project?workspaceId=${encodeURIComponent(workspaceId)}`,
    );
  }

  listMembers(workspaceId: string): Promise<KaneoMember[]> {
    return this.request<KaneoMember[]>(
      `/api/workspace/${encodeURIComponent(workspaceId)}/members`,
    );
  }

  createProject(input: {
    name: string;
    workspaceId: string;
    icon: string;
    slug: string;
  }): Promise<KaneoProject> {
    return this.request<KaneoProject>("/api/project", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  listColumns(projectId: string): Promise<KaneoColumn[]> {
    return this.request<KaneoColumn[]>(
      `/api/column/${encodeURIComponent(projectId)}`,
    );
  }

  createColumn(
    projectId: string,
    input: { name: string; isFinal?: boolean },
  ): Promise<KaneoColumn> {
    return this.request<KaneoColumn>(
      `/api/column/${encodeURIComponent(projectId)}`,
      { method: "POST", body: JSON.stringify(input) },
    );
  }

  deleteColumn(columnId: string): Promise<unknown> {
    return this.request(`/api/column/${encodeURIComponent(columnId)}`, {
      method: "DELETE",
    });
  }

  createTask(
    projectId: string,
    input: {
      title: string;
      description: string;
      status: string;
      priority: string;
      dueDate?: string;
      userId?: string;
    },
  ): Promise<KaneoTask> {
    return this.request<KaneoTask>(
      `/api/task/${encodeURIComponent(projectId)}`,
      { method: "POST", body: JSON.stringify(input) },
    );
  }

  // Never use PUT /label/:id/task: it moves an existing label row off
  // whichever task already had it. This upserts in both scopes.
  createLabel(input: {
    name: string;
    color: string;
    workspaceId: string;
    taskId?: string;
  }): Promise<KaneoLabel> {
    return this.request<KaneoLabel>("/api/label", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  createTaskRelation(input: {
    sourceTaskId: string;
    targetTaskId: string;
    relationType: "subtask" | "blocks" | "related";
  }): Promise<unknown> {
    return this.request("/api/task-relation", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  createComment(
    taskId: string,
    content: string,
    externalUserName?: string,
  ): Promise<unknown> {
    return this.request(`/api/comment/${encodeURIComponent(taskId)}`, {
      method: "POST",
      body: JSON.stringify({
        content,
        ...(externalUserName
          ? { externalUserName, externalSource: "planka" }
          : {}),
      }),
    });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    await this.acquireSlot();
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${this.apiKey}`);
    headers.set("Accept", "application/json");
    if (init?.body != null && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Kaneo ${path}: ${reason}`);
    }

    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text;
      }
    }

    if (!res.ok) {
      throw new Error(`Kaneo ${path}: ${describeError(body, res.status)}`);
    }

    return body as T;
  }
}

function describeError(body: unknown, status: number): string {
  if (status === 401) {
    return "unauthorized (HTTP 401), check your Kaneo API key";
  }
  if (status === 429) {
    return "rate limited (HTTP 429), Kaneo throttled this API key; run again later";
  }
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    for (const key of ["message", "error"]) {
      const value = record[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  if (typeof body === "string" && body.length > 0) {
    return body.length > 300 ? `${body.slice(0, 300)}…` : body;
  }
  return `HTTP ${status}`;
}
