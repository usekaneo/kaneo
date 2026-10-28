import {
  createJsonClient,
  type JsonClient,
  normalizeBaseUrl,
  SourceHttpError,
} from "../http.js";
import type { FetchLike } from "../types.js";

export type PlankaUser = {
  id: string;
  email?: string | null;
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
  createdAt?: string | null;
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
  linkedCardId?: string | null;
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

export type PlankaClientOptions = {
  baseUrl: string;
  token?: string;
  apiKey?: string;
  fetch?: FetchLike;
  signal?: AbortSignal;
};

export class PlankaClient {
  readonly baseUrl: string;
  private token: string | null;
  private readonly apiKey: string | null;
  private readonly fetchImpl: FetchLike | undefined;
  private readonly signal: AbortSignal | undefined;
  private readonly http: JsonClient;

  constructor(options: PlankaClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.token = options.token ?? null;
    this.apiKey = options.apiKey ?? null;
    this.fetchImpl = options.fetch;
    this.signal = options.signal;
    this.http = createJsonClient({
      service: "PLANKA",
      baseUrl: this.baseUrl,
      headers: () => this.authHeaders(),
      fetch: options.fetch,
      signal: options.signal,
      describeUnauthorized:
        "unauthorized (HTTP 401), check your PLANKA credentials or token",
    });
  }

  get isAuthenticated(): boolean {
    return this.token !== null || this.apiKey !== null;
  }

  withSignal(signal: AbortSignal | undefined): PlankaClient {
    if (!signal) return this;
    return new PlankaClient({
      baseUrl: this.baseUrl,
      ...(this.token ? { token: this.token } : {}),
      ...(this.apiKey ? { apiKey: this.apiKey } : {}),
      fetch: this.fetchImpl,
      signal: this.signal ? AbortSignal.any([this.signal, signal]) : signal,
    });
  }

  async login(emailOrUsername: string, password: string): Promise<void> {
    let body: { item?: string } | null;
    try {
      body = await this.http.request<{ item?: string } | null>(
        "/api/access-tokens",
        {
          method: "POST",
          body: JSON.stringify({ emailOrUsername, password }),
        },
      );
    } catch (error) {
      if (error instanceof SourceHttpError) {
        throw new Error(describeLoginFailure(error));
      }
      throw error;
    }

    if (typeof body?.item !== "string" || body.item.length === 0) {
      throw new Error(
        "PLANKA did not return an access token. Create a PLANKA API key for the account and use it instead.",
      );
    }

    this.token = body.item;
  }

  async listProjects(): Promise<ProjectsBundle> {
    const bundle = await this.http.request<ProjectsBundle>("/api/projects");
    return {
      items: bundle.items ?? [],
      included: bundle.included ?? {},
    };
  }

  async getBoard(boardId: string): Promise<BoardBundle> {
    const bundle = await this.http.request<BoardBundle>(
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

    while (true) {
      const query = beforeId ? `?beforeId=${encodeURIComponent(beforeId)}` : "";
      const page = await this.http.request<{
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

    comments.reverse();
    return { comments, users: [...users.values()] };
  }

  private authHeaders(): Record<string, string> {
    if (this.token) return { Authorization: `Bearer ${this.token}` };
    if (this.apiKey) return { "x-api-key": this.apiKey };
    return {};
  }
}

function describeLoginFailure(error: SourceHttpError): string {
  const step =
    typeof error.body === "object" && error.body !== null
      ? (error.body as { step?: unknown }).step
      : undefined;

  if (step === "accept-terms") {
    return "This PLANKA instance requires you to accept its terms before the API will issue a token. Sign in once through the PLANKA web UI, accept the terms, then try again.";
  }

  if (step === "verify-totp") {
    return "This PLANKA account has two-factor authentication enabled, which password login cannot complete. Create a PLANKA API key for the account and use it instead.";
  }

  return error.message;
}
