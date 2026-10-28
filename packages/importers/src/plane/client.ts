import { createJsonClient, type JsonClient, SourceHttpError } from "../http.js";
import type { FetchLike } from "../types.js";
import { MAX_PACE_MS } from "./pacing.js";

export type PlaneUser = {
  id: string;
  email?: string | null;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export type PlaneMember = PlaneUser & { member?: PlaneUser | null };

export type PlaneProject = {
  id: string;
  name: string;
  identifier?: string | null;
  description?: string | null;
  archived_at?: string | null;
};

export type PlaneState = {
  id: string;
  name: string;
  color?: string | null;
  group?: string | null;
  sequence?: number | null;
};

export type PlaneLabel = {
  id: string;
  name: string;
  color?: string | null;
  parent?: string | null;
};

export type PlaneWorkItem = {
  id: string;
  name?: string | null;
  description_html?: string | null;
  priority?: string | null;
  state?: string | null;
  assignees?: Array<string | PlaneUser> | null;
  labels?: string[] | null;
  parent?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  sort_order?: number | null;
  sequence_id?: number | null;
  created_at?: string | null;
  archived_at?: string | null;
};

export type PlaneComment = {
  id: string;
  comment_html?: string | null;
  comment_stripped?: string | null;
  created_at?: string | null;
  actor?: string | PlaneUser | null;
  actor_detail?: PlaneUser | null;
};

export type PlanePage<T> =
  | T[]
  | {
      results?: T[] | null;
      next_cursor?: string | null;
      next_page_results?: boolean | null;
      total_results?: number | null;
      total_count?: number | null;
    };

export type PageProgress = (loaded: number, total: number | undefined) => void;

export type WorkItemSegment = "work-items" | "issues";

export const PAGE_SIZE = 100;
export const REQUEST_TIMEOUT_MS = 30_000 + MAX_PACE_MS;

export const WORK_ITEM_FIELDS = [
  "id",
  "name",
  "description_html",
  "priority",
  "state",
  "assignees",
  "labels",
  "parent",
  "start_date",
  "target_date",
  "sort_order",
  "sequence_id",
  "created_at",
  "archived_at",
];

export type PlaneClientOptions = {
  baseUrl: string;
  apiKey: string;
  workspaceSlug: string;
  fetch: FetchLike;
  signal?: AbortSignal;
};

type SharedState = { segment: WorkItemSegment | null };

export class PlaneClient {
  readonly workspaceSlug: string;
  private readonly http: JsonClient;

  constructor(
    private readonly options: PlaneClientOptions,
    private readonly shared: SharedState = { segment: null },
  ) {
    this.workspaceSlug = options.workspaceSlug;
    this.http = createJsonClient({
      service: "Plane",
      baseUrl: options.baseUrl,
      headers: () => ({ "X-API-Key": options.apiKey }),
      fetch: options.fetch,
      signal: options.signal,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
  }

  withSignal(signal: AbortSignal | undefined): PlaneClient {
    if (!signal) return this;
    const current = this.options.signal;
    return new PlaneClient(
      {
        ...this.options,
        signal: current ? AbortSignal.any([current, signal]) : signal,
      },
      this.shared,
    );
  }

  me(): Promise<PlaneUser | null> {
    return this.http.request<PlaneUser | null>("/api/v1/users/me/");
  }

  listProjects(): Promise<PlaneProject[]> {
    return this.listAll<PlaneProject>(this.workspacePath("/projects/"));
  }

  getProject(projectId: string): Promise<PlaneProject> {
    return this.http.request<PlaneProject>(this.projectPath(projectId, "/"));
  }

  listStates(projectId: string): Promise<PlaneState[]> {
    return this.listAll<PlaneState>(this.projectPath(projectId, "/states/"));
  }

  listLabels(projectId: string): Promise<PlaneLabel[]> {
    return this.listAll<PlaneLabel>(this.projectPath(projectId, "/labels/"));
  }

  listMembers(projectId: string): Promise<PlaneMember[]> {
    return this.listAll<PlaneMember>(this.projectPath(projectId, "/members/"));
  }

  listWorkItems(
    projectId: string,
    options: { expandAssignees?: boolean; onPage?: PageProgress } = {},
  ): Promise<PlaneWorkItem[]> {
    const query: Record<string, string> = {
      fields: WORK_ITEM_FIELDS.join(","),
    };
    if (options.expandAssignees) query.expand = "assignees";
    return this.withWorkItemSegment((segment) =>
      this.listAll<PlaneWorkItem>(
        this.projectPath(projectId, `/${segment}/`),
        query,
        options.onPage,
      ),
    );
  }

  listComments(projectId: string, workItemId: string): Promise<PlaneComment[]> {
    return this.withWorkItemSegment((segment) =>
      this.listAll<PlaneComment>(
        this.projectPath(
          projectId,
          `/${segment}/${encodeURIComponent(workItemId)}/comments/`,
        ),
        { expand: "actor" },
      ),
    );
  }

  private async withWorkItemSegment<T>(
    run: (segment: WorkItemSegment) => Promise<T>,
  ): Promise<T> {
    if (this.shared.segment) return run(this.shared.segment);
    try {
      const result = await run("work-items");
      this.shared.segment = "work-items";
      return result;
    } catch (error) {
      if (!(error instanceof SourceHttpError) || error.status !== 404) {
        throw error;
      }
    }
    const result = await run("issues");
    this.shared.segment = "issues";
    return result;
  }

  private async listAll<T>(
    path: string,
    query: Record<string, string> = {},
    onPage?: PageProgress,
  ): Promise<T[]> {
    const items: T[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;

    for (;;) {
      const params = new URLSearchParams({
        ...query,
        per_page: String(PAGE_SIZE),
      });
      if (cursor) params.set("cursor", cursor);
      const page = await this.http.request<PlanePage<T> | null>(
        `${path}?${params}`,
      );

      if (Array.isArray(page)) {
        items.push(...page);
        onPage?.(items.length, items.length);
        return items;
      }

      const results = page?.results ?? [];
      items.push(...results);
      const total = page?.total_results ?? page?.total_count;
      onPage?.(items.length, typeof total === "number" ? total : undefined);

      const next = page?.next_cursor;
      if (
        !next ||
        page?.next_page_results === false ||
        results.length === 0 ||
        seenCursors.has(next)
      ) {
        return items;
      }
      seenCursors.add(next);
      cursor = next;
    }
  }

  private workspacePath(suffix: string): string {
    return `/api/v1/workspaces/${encodeURIComponent(this.workspaceSlug)}${suffix}`;
  }

  private projectPath(projectId: string, suffix: string): string {
    return this.workspacePath(
      `/projects/${encodeURIComponent(projectId)}${suffix}`,
    );
  }
}
