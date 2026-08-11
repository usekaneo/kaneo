export type PlankaUser = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
};

export type PlankaProject = {
  id: string;
  name: string;
};

export type PlankaBoard = {
  id: string;
  projectId: string;
  name: string;
  position: number | null;
};

// active/closed are the kanban lists whose cards arrive in full from
// GET /boards/:id. archive and trash are "endless" lists that paginate
// separately, and we deliberately do not migrate them.
export const MIGRATABLE_LIST_TYPES = ["active", "closed"];

export type PlankaList = {
  id: string;
  boardId: string;
  name: string | null;
  type: string;
  position: number | null;
  color: string | null;
};

export type PlankaCard = {
  id: string;
  boardId: string;
  listId: string;
  name: string;
  description: string | null;
  position: number | null;
  dueDate: string | null;
  isDueCompleted: boolean | null;
  isClosed: boolean | null;
  commentsTotal: number | null;
};

export type PlankaLabel = {
  id: string;
  boardId: string;
  name: string | null;
  color: string;
  position: number;
};

export type PlankaCardLabel = { cardId: string; labelId: string };
export type PlankaCardMembership = { cardId: string; userId: string };
export type PlankaTaskList = { id: string; cardId: string; name: string };
export type PlankaTask = {
  id: string;
  taskListId: string;
  name: string;
  isCompleted: boolean | null;
  position: number;
};
export type PlankaAttachment = { id: string; cardId: string };
export type PlankaComment = {
  id: string;
  cardId: string;
  userId: string | null;
  text: string;
  createdAt: string | null;
};

export type BoardBundle = {
  item: PlankaBoard;
  included: {
    lists?: PlankaList[];
    cards?: PlankaCard[];
    labels?: PlankaLabel[];
    cardLabels?: PlankaCardLabel[];
    cardMemberships?: PlankaCardMembership[];
    taskLists?: PlankaTaskList[];
    tasks?: PlankaTask[];
    attachments?: PlankaAttachment[];
    users?: PlankaUser[];
  };
};

export type ProjectsBundle = {
  items: PlankaProject[];
  included: { boards?: PlankaBoard[]; users?: PlankaUser[] };
};

export function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export class PlankaClient {
  readonly baseUrl: string;
  private token: string | null;

  constructor(options: { baseUrl: string; token?: string }) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.token = options.token ?? null;
  }

  async login(emailOrUsername: string, password: string): Promise<void> {
    let body: { item?: string };
    try {
      body = await this.request<{ item?: string }>("/api/access-tokens", {
        method: "POST",
        body: JSON.stringify({ emailOrUsername, password }),
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      if (error instanceof PlankaHttpError) {
        throw new Error(describeLoginFailure(error));
      }
      throw error;
    }

    if (typeof body.item !== "string" || body.item.length === 0) {
      throw new Error(
        "PLANKA did not return an access token. Pass --planka-token instead.",
      );
    }

    this.token = body.item;
  }

  async listProjects(): Promise<ProjectsBundle> {
    const bundle = await this.request<ProjectsBundle>("/api/projects");
    return {
      items: bundle.items ?? [],
      included: bundle.included ?? {},
    };
  }

  async getBoard(boardId: string): Promise<BoardBundle> {
    const bundle = await this.request<BoardBundle>(
      `/api/boards/${encodeURIComponent(boardId)}`,
    );
    return { item: bundle.item, included: bundle.included ?? {} };
  }

  async listComments(cardId: string): Promise<{
    comments: PlankaComment[];
    users: PlankaUser[];
  }> {
    const comments: PlankaComment[] = [];
    const users = new Map<string, PlankaUser>();
    let beforeId: string | undefined;

    // The endpoint is cursor-paginated and has no "total" to check against, so
    // we walk until a page comes back empty or repeats the cursor.
    while (true) {
      const query = beforeId ? `?beforeId=${encodeURIComponent(beforeId)}` : "";
      const page = await this.request<{
        items: PlankaComment[];
        included?: { users?: PlankaUser[] };
      }>(`/api/cards/${encodeURIComponent(cardId)}/comments${query}`);

      const items = page.items ?? [];
      if (items.length === 0) break;

      comments.push(...items);
      for (const user of page.included?.users ?? []) {
        users.set(user.id, user);
      }

      const oldest = items[items.length - 1];
      if (!oldest || oldest.id === beforeId) break;
      beforeId = oldest.id;
    }

    // PLANKA returns newest first; replay them in the order they were written.
    comments.reverse();
    return { comments, users: [...users.values()] };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (this.token) {
      headers.set("Authorization", `Bearer ${this.token}`);
    }
    headers.set("Accept", "application/json");

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`PLANKA ${path}: ${reason}`);
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
      throw new PlankaHttpError(
        `PLANKA ${path}: ${describeError(body, res.status)}`,
        res.status,
        body,
      );
    }

    return body as T;
  }
}

export class PlankaHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "PlankaHttpError";
  }
}

/**
 * PLANKA answers a password login with 403 and a `step` when the account still
 * has something to clear (instance terms, or two-factor). Neither can be
 * completed non-interactively, so say which one it is and how to get past it.
 */
function describeLoginFailure(error: PlankaHttpError): string {
  const step =
    typeof error.body === "object" && error.body !== null
      ? (error.body as { step?: unknown }).step
      : undefined;

  if (step === "accept-terms") {
    return "This PLANKA instance requires you to accept its terms before the API will issue a token. Sign in once through the PLANKA web UI, accept the terms, then run this again.";
  }

  if (step === "verify-totp") {
    return "This PLANKA account has two-factor authentication enabled, which password login cannot complete. Copy an access token from your browser's dev tools and pass --planka-token instead.";
  }

  return error.message;
}

function describeError(body: unknown, status: number): string {
  if (status === 401) {
    return "unauthorized (HTTP 401), check your PLANKA credentials or token";
  }
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    for (const key of ["message", "problem", "error"]) {
      const value = record[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  if (typeof body === "string" && body.length > 0) {
    return body.length > 300 ? `${body.slice(0, 300)}…` : body;
  }
  return `HTTP ${status}`;
}
