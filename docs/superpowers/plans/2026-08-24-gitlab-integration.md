# GitLab Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `gitlab-integration` API module + `plugins/gitlab` plugin, giving Kaneo the same two-way sync with GitLab.com or self-managed ("on premise") GitLab that it already has with Gitea.

**Architecture:** Directly mirrors `apps/api/src/gitea-integration` + `apps/api/src/plugins/gitea`, adapted to GitLab REST v4 (`PRIVATE-TOKEN` auth, `iid`-addressed issues/MRs, path-based project identity, `X-Gitlab-Token` webhook secret instead of HMAC). Reuses the existing polymorphic `integrationTable`/`workflowRuleTable` (`type`/`integrationType: "gitlab"`) and the generic `plugins/github/services/{link-manager,task-service}` — no schema migration.

**Tech Stack:** Hono, Valibot, Drizzle ORM, vitest (`apps/api`), React/TanStack Query (`apps/web`), i18next.

**Spec:** `docs/superpowers/specs/2026-08-24-gitlab-integration-design.md`

## Global Constraints

- Auth: personal/project access token via `PRIVATE-TOKEN` header (GitLab convention). No OAuth app/installation flow.
- Base API path: `/api/v4`. Project addressed via `encodeURIComponent(repositoryPath)` as `:id`, where `repositoryPath` is the full namespace path (e.g. `group/subgroup/project`), not owner+name.
- Issues/MRs addressed by `iid` (project-scoped sequential number) everywhere Gitea used `number`/`index`.
- Every outbound HTTP call must run through `assertPublicDestination()` (`apps/api/src/utils/assert-public-destination.ts`) before the request — reused as-is, no changes to that file.
- Webhook auth is a constant-time compare of `X-Gitlab-Token` against the stored secret — no HMAC.
- `integrationTable.type = "gitlab"`, `workflowRuleTable.integrationType = "gitlab"` — both are plain `text` columns already, confirmed no migration needed.
- No new workspace permission — reuse `manage_settings` via `requireWorkspacePermission({ workspace: ["manage_settings"] })`.
- User-facing web copy goes in `i18n/en-US.json` only (source of truth) — no hardcoded UI strings.
- Follow existing Gitea file/test layout exactly (see spec §6): unit tests live in `tests/api/gitlab-integration/` and `tests/api/plugins/gitlab/`, using vitest with `vi.hoisted()` + `vi.mock()` against relative import paths.

---

### Task 1: GitLab config schema (`plugins/gitlab/config.ts`)

**Files:**
- Create: `apps/api/src/plugins/gitlab/config.ts`
- Test: `tests/api/plugins/gitlab-config.test.ts`

**Interfaces:**
- Produces: `gitlabConfigSchema` (valibot), `type GitlabConfig`, `validateGitlabConfig(config: unknown): Promise<{valid: boolean; errors?: string[]}>`, `defaultGitlabConfig: Partial<GitlabConfig>`, `normalizeGitlabBaseUrl(url: string): string`, `getDefaultGitlabConfig(baseUrl: string, accessToken: string, repositoryPath: string, webhookSecret: string): GitlabConfig`, re-exports `branchPatterns` from `../github/config`. Every later task that touches `GitlabConfig` imports from this file.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/plugins/gitlab-config.test.ts
import { describe, expect, it } from "vitest";
import {
  normalizeGitlabBaseUrl,
  validateGitlabConfig,
} from "../../../apps/api/src/plugins/gitlab/config";

describe("normalizeGitlabBaseUrl", () => {
  it("keeps a plain base URL usable", () => {
    expect(normalizeGitlabBaseUrl("https://gitlab.example.com/")).toBe(
      "https://gitlab.example.com",
    );
    expect(normalizeGitlabBaseUrl("https://gitlab.example.com/sub/")).toBe(
      "https://gitlab.example.com/sub",
    );
  });

  it("rejects a query or fragment that would hijack the request path", () => {
    expect(() => normalizeGitlabBaseUrl("http://example.com/?x=1")).toThrow(
      /query, fragment, or credentials/,
    );
    expect(() => normalizeGitlabBaseUrl("http://example.com/#frag")).toThrow(
      /query, fragment, or credentials/,
    );
  });

  it("rejects embedded credentials and non-http schemes", () => {
    expect(() =>
      normalizeGitlabBaseUrl("http://user:pass@example.com"),
    ).toThrow(/query, fragment, or credentials/);
    expect(() => normalizeGitlabBaseUrl("file:///etc/passwd")).toThrow(
      /must use http or https/,
    );
  });
});

describe("validateGitlabConfig", () => {
  it("accepts a minimal valid config", async () => {
    const result = await validateGitlabConfig({
      baseUrl: "https://gitlab.example.com",
      accessToken: "token",
      repositoryPath: "group/subgroup/project",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a config missing repositoryPath", async () => {
    const result = await validateGitlabConfig({
      baseUrl: "https://gitlab.example.com",
      accessToken: "token",
      repositoryPath: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kaneo/api test:unit -- gitlab-config`
Expected: FAIL — `plugins/gitlab/config.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/api/src/plugins/gitlab/config.ts
import * as v from "valibot";
import { branchPatterns } from "../github/config";

export { branchPatterns };

export const gitlabConfigSchema = v.object({
  baseUrl: v.pipe(v.string(), v.url()),
  accessToken: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  repositoryPath: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  webhookSecret: v.optional(v.string()),
  branchPattern: v.optional(v.string()),
  customBranchRegex: v.optional(v.string()),
  commentTaskLinkOnGitlabIssue: v.optional(v.boolean()),
  statusTransitions: v.optional(
    v.object({
      onBranchPush: v.optional(v.string()),
      onMROpen: v.optional(v.string()),
      onMRMerge: v.optional(v.string()),
    }),
  ),
});

export type GitlabConfig = v.InferOutput<typeof gitlabConfigSchema>;

export async function validateGitlabConfig(
  config: unknown,
): Promise<{ valid: boolean; errors?: string[] }> {
  try {
    v.parse(gitlabConfigSchema, config);
    return { valid: true };
  } catch (error) {
    if (error instanceof v.ValiError) {
      return {
        valid: false,
        errors: error.issues.map((issue) => issue.message),
      };
    }
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "Invalid config"],
    };
  }
}

export const defaultGitlabConfig: Partial<GitlabConfig> = {
  branchPattern: "{slug}-{number}",
  commentTaskLinkOnGitlabIssue: true,
  statusTransitions: {
    onBranchPush: "in-progress",
    onMROpen: "in-review",
    onMRMerge: "done",
  },
};

export function normalizeGitlabBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  const parsed = new URL(trimmed);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("GitLab base URL must use http or https");
  }

  // A query or fragment would swallow the appended /api/v4/... path and let a
  // caller aim the request at an arbitrary path on the target host.
  if (parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error(
      "GitLab base URL must not contain a query, fragment, or credentials",
    );
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

export function getDefaultGitlabConfig(
  baseUrl: string,
  accessToken: string,
  repositoryPath: string,
  webhookSecret: string,
): GitlabConfig {
  return {
    baseUrl: normalizeGitlabBaseUrl(baseUrl),
    accessToken,
    repositoryPath,
    webhookSecret,
    ...defaultGitlabConfig,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kaneo/api test:unit -- gitlab-config`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/plugins/gitlab/config.ts tests/api/plugins/gitlab-config.test.ts
git commit -m "feat(api): add GitLab integration config schema"
```

---

### Task 2: GitLab API client (`plugins/gitlab/utils/gitlab-api.ts`)

**Files:**
- Create: `apps/api/src/plugins/gitlab/utils/gitlab-api.ts`
- Test: `tests/api/plugins/gitlab-ssrf.test.ts`

**Interfaces:**
- Consumes: `normalizeGitlabBaseUrl`, `type GitlabConfig` from Task 1 (`../config`).
- Produces: `type GitlabLabel = {id: number; name: string; color?: string}`, `type GitlabIssue = {id: number; iid: number; title: string; description: string | null; web_url: string; state: string; labels?: string[]; author?: {username?: string; avatar_url?: string} | null}`, `type GitlabNote = {id: number; body: string; author?: {username?: string; avatar_url?: string} | null; created_at: string}`, `type GitlabMergeRequest = {iid: number; title: string; description: string | null; web_url: string; state: string; source_branch: string; author?: {username?: string; avatar_url?: string} | null; merged_at?: string | null}`, `class GitlabApiError extends Error` (fields `status`, `kind: "REDIRECT"|"INVALID_JSON"|"HTTP_ERROR"|"TIMEOUT"|"EMPTY_RESPONSE"`, `body?`), `gitlabFetch<T>(baseUrl, token, path, init?): Promise<T | undefined>`, `createGitlabClient(config: Pick<GitlabConfig, "baseUrl"|"accessToken">)` returning an object with async methods `getProject(repositoryPath)`, `listUserProjects(page, perPage)`, `createIssue(repositoryPath, body)`, `updateIssue(repositoryPath, issueIid, body)`, `listIssueNotes(repositoryPath, issueIid, page, perPage)`, `createIssueNote(repositoryPath, issueIid, body)`, `listLabels(repositoryPath)`, `createLabel(repositoryPath, name, color)`, `getIssue(repositoryPath, issueIid)`, `listIssues(repositoryPath, page, state)`, `listMergeRequests(repositoryPath, page)` — every later task's client calls use these exact method names and argument order. `verifyGitlabToken(baseUrl, token)` (checks the PAT via `GET /user` — distinct from the webhook-secret checker in Task 3, which is named `verifyGitlabWebhookSecret`).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/plugins/gitlab-ssrf.test.ts
import { describe, expect, it } from "vitest";
import { normalizeGitlabBaseUrl } from "../../../apps/api/src/plugins/gitlab/config";
import { gitlabFetch } from "../../../apps/api/src/plugins/gitlab/utils/gitlab-api";

describe("normalizeGitlabBaseUrl (re-verified against the client's own import)", () => {
  it("strips a bare trailing # so the api path cannot be truncated", () => {
    expect(
      normalizeGitlabBaseUrl(
        "http://169.254.169.254/latest/meta-data/iam/security-credentials/role#",
      ),
    ).toBe(
      "http://169.254.169.254/latest/meta-data/iam/security-credentials/role",
    );
  });
});

describe("gitlabFetch destination guard", () => {
  const internalTargets = [
    "http://127.0.0.1:1337",
    "http://localhost:1337",
    "http://169.254.169.254",
    "http://10.0.0.5",
    "http://192.168.1.10",
    "http://172.16.0.1",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
  ];

  for (const target of internalTargets) {
    it(`refuses to request ${target}`, async () => {
      await expect(gitlabFetch(target, "token", "/user")).rejects.toThrow(
        /non-routable/,
      );
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kaneo/api test:unit -- gitlab-ssrf`
Expected: FAIL — `plugins/gitlab/utils/gitlab-api.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/api/src/plugins/gitlab/utils/gitlab-api.ts
import * as Sentry from "@sentry/node";
import { assertPublicDestination } from "../../../utils/assert-public-destination";
import type { GitlabConfig } from "../config";
import { normalizeGitlabBaseUrl } from "../config";

export type GitlabLabel = {
  id: number;
  name: string;
  color?: string;
};

export type GitlabIssue = {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  web_url: string;
  state: string;
  labels?: string[];
  author?: { username?: string; avatar_url?: string } | null;
};

export type GitlabNote = {
  id: number;
  body: string;
  author?: { username?: string; avatar_url?: string } | null;
  created_at: string;
};

export type GitlabMergeRequest = {
  iid: number;
  title: string;
  description: string | null;
  web_url: string;
  state: string;
  source_branch: string;
  author?: { username?: string; avatar_url?: string } | null;
  merged_at?: string | null;
};

export type GitlabApiErrorKind =
  | "REDIRECT"
  | "INVALID_JSON"
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "EMPTY_RESPONSE";

export class GitlabApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public kind: GitlabApiErrorKind,
    public body?: string,
  ) {
    super(message);
    this.name = "GitlabApiError";
  }
}

function authHeaders(token: string): HeadersInit {
  return {
    "PRIVATE-TOKEN": token,
    "Content-Type": "application/json",
  };
}

const GITLAB_FETCH_TIMEOUT_MS = 10_000;

export async function gitlabFetch<T>(
  baseUrl: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T | undefined> {
  const root = normalizeGitlabBaseUrl(baseUrl);
  const url = `${root}/api/v4${path.startsWith("/") ? path : `/${path}`}`;

  await assertPublicDestination(root, "GitLab");

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, GITLAB_FETCH_TIMEOUT_MS);
  if (init?.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  try {
    Sentry.addBreadcrumb({
      category: "integration",
      level: "info",
      data: { integration: "gitlab" },
    });
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      // Following redirects would let a public host bounce the request to an
      // internal address after the destination check has already passed.
      redirect: "manual",
      headers: {
        ...authHeaders(token),
        ...init?.headers,
      },
    });

    if (res.status >= 300 && res.status < 400) {
      throw new GitlabApiError(
        `GitLab request was redirected (HTTP ${res.status})`,
        res.status,
        "REDIRECT",
      );
    }

    const text = await res.text();
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new GitlabApiError(
        `GitLab API error ${res.status}`,
        res.status,
        "HTTP_ERROR",
        text,
      );
    }

    if (res.status === 204 || text === "") {
      return undefined;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new GitlabApiError(
        "GitLab API returned invalid JSON",
        res.status,
        "INVALID_JSON",
        text,
      );
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof GitlabApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      if (timedOut) {
        throw new GitlabApiError(
          `GitLab request timed out after ${GITLAB_FETCH_TIMEOUT_MS}ms`,
          408,
          "TIMEOUT",
        );
      }
      throw error;
    }
    throw error;
  }
}

export function createGitlabClient(
  config: Pick<GitlabConfig, "baseUrl" | "accessToken">,
) {
  const { baseUrl, accessToken } = config;
  const project = (repositoryPath: string) =>
    `/projects/${encodeURIComponent(repositoryPath)}`;

  return {
    async getProject(repositoryPath: string): Promise<{
      id: number;
      path_with_namespace: string;
      web_url: string;
      visibility: string;
      permissions?: {
        project_access?: { access_level: number } | null;
        group_access?: { access_level: number } | null;
      };
    }> {
      const repo = await gitlabFetch<{
        id: number;
        path_with_namespace: string;
        web_url: string;
        visibility: string;
        permissions?: {
          project_access?: { access_level: number } | null;
          group_access?: { access_level: number } | null;
        };
      }>(baseUrl, accessToken, project(repositoryPath));
      if (!repo) {
        throw new GitlabApiError(
          "GitLab project response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return repo;
    },

    async listUserProjects(
      page = 1,
      perPage = 50,
    ): Promise<
      Array<{
        id: number;
        name: string;
        path_with_namespace: string;
        visibility: string;
        web_url: string;
      }>
    > {
      const projects = await gitlabFetch<
        Array<{
          id: number;
          name: string;
          path_with_namespace: string;
          visibility: string;
          web_url: string;
        }>
      >(
        baseUrl,
        accessToken,
        `/projects?membership=true&page=${page}&per_page=${perPage}`,
      );
      if (!projects) {
        throw new GitlabApiError(
          "GitLab projects response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return projects;
    },

    async createIssue(
      repositoryPath: string,
      body: { title: string; description?: string | null },
    ): Promise<GitlabIssue> {
      const issue = await gitlabFetch<GitlabIssue>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/issues`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      if (!issue) {
        throw new GitlabApiError(
          "GitLab create issue response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return issue;
    },

    async updateIssue(
      repositoryPath: string,
      issueIid: number,
      body: Record<string, unknown>,
    ): Promise<GitlabIssue> {
      const issue = await gitlabFetch<GitlabIssue>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/issues/${issueIid}`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        },
      );
      if (!issue) {
        throw new GitlabApiError(
          "GitLab update issue response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return issue;
    },

    async listIssueNotes(
      repositoryPath: string,
      issueIid: number,
      page: number,
      perPage: number,
    ): Promise<GitlabNote[]> {
      const notes = await gitlabFetch<GitlabNote[]>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/issues/${issueIid}/notes?page=${page}&per_page=${perPage}&order_by=created_at&sort=asc`,
      );
      if (!notes) {
        throw new GitlabApiError(
          "GitLab notes response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return notes;
    },

    async createIssueNote(
      repositoryPath: string,
      issueIid: number,
      body: string,
    ): Promise<GitlabNote> {
      const note = await gitlabFetch<GitlabNote>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/issues/${issueIid}/notes`,
        {
          method: "POST",
          body: JSON.stringify({ body }),
        },
      );
      if (!note) {
        throw new GitlabApiError(
          "GitLab create note response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return note;
    },

    async listLabels(repositoryPath: string): Promise<GitlabLabel[]> {
      const labels = await gitlabFetch<GitlabLabel[]>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/labels`,
      );
      if (!labels) {
        throw new GitlabApiError(
          "GitLab labels response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return labels;
    },

    async createLabel(
      repositoryPath: string,
      name: string,
      color: string,
    ): Promise<GitlabLabel> {
      const label = await gitlabFetch<GitlabLabel>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/labels`,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            color: color.startsWith("#") ? color : `#${color}`,
          }),
        },
      );
      if (!label) {
        throw new GitlabApiError(
          "GitLab create label response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return label;
    },

    async getIssue(
      repositoryPath: string,
      issueIid: number,
    ): Promise<GitlabIssue> {
      const issue = await gitlabFetch<GitlabIssue>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/issues/${issueIid}`,
      );
      if (!issue) {
        throw new GitlabApiError(
          "GitLab issue response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return issue;
    },

    async listIssues(
      repositoryPath: string,
      page: number,
      state: "opened" | "closed" | "all",
    ): Promise<GitlabIssue[]> {
      const issues = await gitlabFetch<GitlabIssue[]>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/issues?state=${state}&page=${page}&per_page=100`,
      );
      if (!issues) {
        throw new GitlabApiError(
          "GitLab issues response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return issues;
    },

    async listMergeRequests(
      repositoryPath: string,
      page: number,
    ): Promise<GitlabMergeRequest[]> {
      const mrs = await gitlabFetch<GitlabMergeRequest[]>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/merge_requests?state=opened&page=${page}&per_page=100`,
      );
      if (!mrs) {
        throw new GitlabApiError(
          "GitLab merge requests response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return mrs;
    },
  };
}

export async function verifyGitlabToken(baseUrl: string, token: string) {
  const user = await gitlabFetch<{ id: number; username: string }>(
    normalizeGitlabBaseUrl(baseUrl),
    token,
    "/user",
  );
  if (!user) {
    throw new GitlabApiError(
      "GitLab user response was empty",
      500,
      "EMPTY_RESPONSE",
    );
  }
  return user;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kaneo/api test:unit -- gitlab-ssrf`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/plugins/gitlab/utils/gitlab-api.ts tests/api/plugins/gitlab-ssrf.test.ts
git commit -m "feat(api): add GitLab REST v4 API client"
```

---

### Task 3: Webhook secret verification (`plugins/gitlab/utils/verify-token.ts`)

**Files:**
- Create: `apps/api/src/plugins/gitlab/utils/verify-token.ts`
- Test: `tests/api/plugins/gitlab/verify-token.test.ts`

**Interfaces:**
- Produces: `verifyGitlabWebhookSecret(secret: string, tokenHeader: string | undefined): boolean`. Consumed by the webhook handler in Task 14.

GitLab does not HMAC-sign payloads — it echoes the configured secret verbatim in `X-Gitlab-Token`. This must stay constant-time to avoid a timing side channel on the secret, matching the spirit of `verifyGiteaSignature` (`apps/api/src/plugins/gitea/utils/verify-signature.ts`) even though the comparison itself is simpler (no HMAC/hex decode).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/plugins/gitlab/verify-token.test.ts
import { describe, expect, it } from "vitest";
import { verifyGitlabWebhookSecret } from "../../../../apps/api/src/plugins/gitlab/utils/verify-token";

describe("verifyGitlabWebhookSecret", () => {
  it("accepts a matching secret", () => {
    expect(verifyGitlabWebhookSecret("s3cr3t", "s3cr3t")).toBe(true);
  });

  it("rejects a wrong secret", () => {
    expect(verifyGitlabWebhookSecret("s3cr3t", "wrong")).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyGitlabWebhookSecret("s3cr3t", undefined)).toBe(false);
  });

  it("rejects when the stored secret is empty", () => {
    expect(verifyGitlabWebhookSecret("", "anything")).toBe(false);
  });

  it("rejects a same-prefix header of different length without throwing", () => {
    expect(verifyGitlabWebhookSecret("s3cr3t", "s3cr3")).toBe(false);
    expect(verifyGitlabWebhookSecret("s3cr3t", "s3cr3txx")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kaneo/api test:unit -- verify-token`
Expected: FAIL — `plugins/gitlab/utils/verify-token.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/api/src/plugins/gitlab/utils/verify-token.ts
import { timingSafeEqual } from "node:crypto";

/**
 * GitLab webhooks echo the configured secret verbatim in X-Gitlab-Token
 * (no HMAC, unlike GitHub/Gitea). Length is checked before timingSafeEqual
 * because that function throws on mismatched buffer lengths.
 */
export function verifyGitlabWebhookSecret(
  secret: string,
  tokenHeader: string | undefined,
): boolean {
  if (!tokenHeader || !secret) {
    return false;
  }

  const a = Buffer.from(tokenHeader);
  const b = Buffer.from(secret);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kaneo/api test:unit -- verify-token`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/plugins/gitlab/utils/verify-token.ts tests/api/plugins/gitlab/verify-token.test.ts
git commit -m "feat(api): add GitLab webhook secret verification"
```

---

### Task 4: Shared plugin utils (webhook repo resolution, branch matching, echo guard, resolve-column, integration lookup)

**Files:**
- Create: `apps/api/src/plugins/gitlab/utils/webhook-repo.ts`
- Create: `apps/api/src/plugins/gitlab/utils/branch-matcher.ts`
- Create: `apps/api/src/plugins/gitlab/utils/outbound-echo.ts`
- Create: `apps/api/src/plugins/gitlab/utils/system-labels.ts`
- Create: `apps/api/src/plugins/gitlab/utils/resolve-column.ts`
- Create: `apps/api/src/plugins/gitlab/services/integration-lookup.ts`
- Test: `tests/api/plugins/gitlab/webhook-repo.test.ts`

**Interfaces:**
- Consumes: `normalizeGitlabBaseUrl`, `type GitlabConfig` (Task 1); `github/config`'s `GitHubConfig`, `github/utils/branch-matcher`'s `extractTaskNumber`, `extractTaskNumberFromBranch`, `extractTaskNumberFromPRBody`, `extractTaskNumberFromPRTitle`, `generateBranchName` (existing, unmodified).
- Produces: `baseUrlFromProjectWebUrl(webUrl: string, pathWithNamespace: string): string`; `extractTaskNumberFromBranchGitlab(branchName, config, projectSlug): number | null`, `extractTaskNumberGitlab(branchName, mrTitle, mrBody, config, projectSlug): number | null`, plus re-exported `extractTaskNumberFromPRBody`, `extractTaskNumberFromPRTitle`, `generateBranchName`; `OUTBOUND_STATE_ECHO_WINDOW_MS: number`, `parseIssueUpdatedAtMs(issue: {updated_at?: string}): number | null`; `isSystemLabelName(name: string): boolean`; `resolveTargetStatus(projectId: string, eventType: string, fallbackStatus: string): Promise<string>`; `findAllIntegrationsByGitlabProject(baseUrl: string, repositoryPath: string, integrationId?: string): Promise<...>`. All webhook and event tasks (5–14) import from these files.

GitLab webhook payloads include `project.path_with_namespace` and `project.web_url` directly, so — unlike Gitea's `baseUrlFromRepositoryHtmlUrl`, which has to strip exactly two trailing path segments off `html_url` because Gitea only gives owner+repo — `baseUrlFromProjectWebUrl` strips the known `path_with_namespace` suffix off `web_url`, which is correct at any nesting depth (`group/subgroup/project`).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/plugins/gitlab/webhook-repo.test.ts
import { describe, expect, it } from "vitest";
import { baseUrlFromProjectWebUrl } from "../../../../apps/api/src/plugins/gitlab/utils/webhook-repo";

describe("baseUrlFromProjectWebUrl", () => {
  it("strips a top-level project path", () => {
    expect(
      baseUrlFromProjectWebUrl(
        "https://gitlab.example.com/owner/repo",
        "owner/repo",
      ),
    ).toBe("https://gitlab.example.com");
  });

  it("strips an arbitrarily nested group/subgroup path", () => {
    expect(
      baseUrlFromProjectWebUrl(
        "https://gitlab.example.com/group/subgroup/project",
        "group/subgroup/project",
      ),
    ).toBe("https://gitlab.example.com");
  });

  it("returns an empty string when the web_url does not end with path_with_namespace", () => {
    expect(
      baseUrlFromProjectWebUrl(
        "https://gitlab.example.com/other/path",
        "group/project",
      ),
    ).toBe("");
  });

  it("returns an empty string for an unparsable URL", () => {
    expect(baseUrlFromProjectWebUrl("not-a-url", "group/project")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kaneo/api test:unit -- webhook-repo`
Expected: FAIL — `plugins/gitlab/utils/webhook-repo.ts` does not exist yet.

- [ ] **Step 3: Write the implementations**

```typescript
// apps/api/src/plugins/gitlab/utils/webhook-repo.ts
import { normalizeGitlabBaseUrl } from "../config";

export function baseUrlFromProjectWebUrl(
  webUrl: string,
  pathWithNamespace: string,
): string {
  try {
    const u = new URL(webUrl);
    const suffix = `/${pathWithNamespace}`;
    if (!u.pathname.endsWith(suffix)) {
      return "";
    }
    const basePath = u.pathname.slice(0, -suffix.length);
    return normalizeGitlabBaseUrl(`${u.origin}${basePath}`);
  } catch {
    return "";
  }
}
```

```typescript
// apps/api/src/plugins/gitlab/utils/branch-matcher.ts
import type { GitHubConfig } from "../../github/config";
import {
  extractTaskNumber,
  extractTaskNumberFromBranch,
  extractTaskNumberFromPRBody,
  extractTaskNumberFromPRTitle,
  generateBranchName,
} from "../../github/utils/branch-matcher";
import type { GitlabConfig } from "../config";

function asBranchConfig(config: GitlabConfig): GitHubConfig {
  return config as unknown as GitHubConfig;
}

export {
  extractTaskNumberFromPRBody,
  extractTaskNumberFromPRTitle,
  generateBranchName,
};

export function extractTaskNumberFromBranchGitlab(
  branchName: string,
  config: GitlabConfig,
  projectSlug: string,
): number | null {
  return extractTaskNumberFromBranch(
    branchName,
    asBranchConfig(config),
    projectSlug,
  );
}

export function extractTaskNumberGitlab(
  branchName: string,
  mrTitle: string | undefined,
  mrBody: string | undefined,
  config: GitlabConfig,
  projectSlug: string,
): number | null {
  return extractTaskNumber(
    branchName,
    mrTitle,
    mrBody,
    asBranchConfig(config),
    projectSlug,
  );
}
```

```typescript
// apps/api/src/plugins/gitlab/utils/outbound-echo.ts
/** Skip webhook sync when it likely echoes our own outbound API update. */
export const OUTBOUND_STATE_ECHO_WINDOW_MS = 5000;

export function parseIssueUpdatedAtMs(issue: {
  updated_at?: string;
}): number | null {
  const raw = issue.updated_at;
  if (!raw || typeof raw !== "string") return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}
```

```typescript
// apps/api/src/plugins/gitlab/utils/system-labels.ts
export function isSystemLabelName(name: string) {
  return name.startsWith("priority:") || name.startsWith("status:");
}
```

```typescript
// apps/api/src/plugins/gitlab/utils/resolve-column.ts
import { and, asc, eq } from "drizzle-orm";
import db from "../../../database";
import { columnTable, workflowRuleTable } from "../../../database/schema";

export async function resolveTargetStatus(
  projectId: string,
  eventType: string,
  fallbackStatus: string,
): Promise<string> {
  const projectColumns = await db
    .select({
      id: columnTable.id,
      slug: columnTable.slug,
    })
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId))
    .orderBy(asc(columnTable.position));

  if (projectColumns.length === 0) {
    return fallbackStatus;
  }

  const rule = await db.query.workflowRuleTable.findFirst({
    where: and(
      eq(workflowRuleTable.projectId, projectId),
      eq(workflowRuleTable.integrationType, "gitlab"),
      eq(workflowRuleTable.eventType, eventType),
    ),
  });

  if (rule) {
    const mappedColumn = projectColumns.find(
      (column) => column.id === rule.columnId,
    );
    if (mappedColumn) {
      return mappedColumn.slug;
    }
  }

  const fallbackColumn = projectColumns.find(
    (column) => column.slug === fallbackStatus,
  );
  if (fallbackColumn) {
    return fallbackColumn.slug;
  }

  return projectColumns[0]?.slug ?? fallbackStatus;
}
```

```typescript
// apps/api/src/plugins/gitlab/services/integration-lookup.ts
import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { integrationTable } from "../../../database/schema";
import type { GitlabConfig } from "../config";
import { normalizeGitlabBaseUrl } from "../config";

export async function findAllIntegrationsByGitlabProject(
  baseUrl: string,
  repositoryPath: string,
  integrationId?: string,
) {
  const normalized = normalizeGitlabBaseUrl(baseUrl);
  const conditions = [
    eq(integrationTable.type, "gitlab"),
    eq(integrationTable.isActive, true),
  ];
  if (integrationId) {
    conditions.push(eq(integrationTable.id, integrationId));
  }

  const integrations = await db.query.integrationTable.findMany({
    where: and(...conditions),
    with: {
      project: true,
    },
  });

  return integrations.filter((integration) => {
    try {
      const config = JSON.parse(integration.config) as GitlabConfig;
      const matches =
        normalizeGitlabBaseUrl(config.baseUrl) === normalized &&
        config.repositoryPath === repositoryPath;
      if (integrationId && !matches) {
        console.warn(
          "[GitLab Webhook] Signed integration project mismatch",
          { integrationId },
        );
      }
      return matches;
    } catch {
      return false;
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kaneo/api test:unit -- webhook-repo`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/plugins/gitlab/utils/webhook-repo.ts apps/api/src/plugins/gitlab/utils/branch-matcher.ts apps/api/src/plugins/gitlab/utils/outbound-echo.ts apps/api/src/plugins/gitlab/utils/system-labels.ts apps/api/src/plugins/gitlab/utils/resolve-column.ts apps/api/src/plugins/gitlab/services/integration-lookup.ts tests/api/plugins/gitlab/webhook-repo.test.ts
git commit -m "feat(api): add GitLab plugin shared utils"
```

---

### Task 5: Label sync utils + wiring into label/task controllers

**Files:**
- Create: `apps/api/src/plugins/gitlab/utils/labels.ts`
- Create: `apps/api/src/plugins/gitlab/utils/sync-label-to-gitlab.ts`
- Modify: `apps/api/src/label/controllers/create-label.ts`
- Modify: `apps/api/src/label/controllers/delete-label.ts`
- Modify: `apps/api/src/label/controllers/assign-label-to-task.ts`
- Modify: `apps/api/src/task/controllers/bulk-update-tasks.ts`
- Test: `tests/api/plugins/gitlab/labels.test.ts`

**Interfaces:**
- Consumes: `createGitlabClient` (Task 2), `type GitlabConfig` (Task 1).
- Produces: `ensureLabelsExistGitlab(config, labels: string[]): Promise<void>`, `addLabelsToIssueGitlab(config, issueIid, labelNames: string[]): Promise<void>`, `removeLabelGitlab(config, issueIid, labelName): Promise<void>`, `syncLabelToGitlab(taskId: string, labelName: string, labelColor: string): Promise<void>`, `removeLabelFromGitlab(taskId: string, labelName: string): Promise<void>`. Tasks 8–14 (webhooks/events) use `addLabelsToIssueGitlab`/`removeLabelGitlab`; the four modified controllers use `syncLabelToGitlab`/`removeLabelFromGitlab`.

GitLab's update-issue endpoint accepts `add_labels`/`remove_labels` as comma-joined strings directly, so — unlike Gitea, which needs separate label-ID lookups plus add/replace/remove sub-resource calls — `addLabelsToIssueGitlab`/`removeLabelGitlab` only need to ensure the label exists (for color) and then call `updateIssue` once.

The four modified controllers already call the Gitea and GitHub equivalents side by side (`syncLabelToGitHub`/`syncLabelToGitea`, `removeLabelFromGitHub`/`removeLabelFromGitea`) as fire-and-forget `.catch()` calls — this task adds the third provider alongside them, following the exact same pattern.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/plugins/gitlab/labels.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listLabels: vi.fn(),
  createLabel: vi.fn(),
  updateIssue: vi.fn(),
}));

vi.mock("../../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({
    listLabels: (...args: unknown[]) => mocks.listLabels(...args),
    createLabel: (...args: unknown[]) => mocks.createLabel(...args),
    updateIssue: (...args: unknown[]) => mocks.updateIssue(...args),
  }),
}));

const { addLabelsToIssueGitlab, removeLabelGitlab } = await import(
  "../../../../apps/api/src/plugins/gitlab/utils/labels"
);

const config = {
  baseUrl: "https://gitlab.example.com",
  accessToken: "token",
  repositoryPath: "group/project",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listLabels.mockResolvedValue([{ id: 1, name: "status:to-do" }]);
});

describe("addLabelsToIssueGitlab", () => {
  it("creates a missing label then adds it via a single updateIssue call", async () => {
    await addLabelsToIssueGitlab(config, 5, ["priority:high"]);

    expect(mocks.createLabel).toHaveBeenCalledWith(
      "group/project",
      "priority:high",
      "#F97316",
    );
    expect(mocks.updateIssue).toHaveBeenCalledWith("group/project", 5, {
      add_labels: "priority:high",
    });
  });

  it("does nothing when there are no labels to add", async () => {
    await addLabelsToIssueGitlab(config, 5, []);
    expect(mocks.updateIssue).not.toHaveBeenCalled();
  });
});

describe("removeLabelGitlab", () => {
  it("calls updateIssue with remove_labels", async () => {
    await removeLabelGitlab(config, 5, "status:to-do");
    expect(mocks.updateIssue).toHaveBeenCalledWith("group/project", 5, {
      remove_labels: "status:to-do",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kaneo/api test:unit -- plugins/gitlab/labels`
Expected: FAIL — `plugins/gitlab/utils/labels.ts` does not exist yet.

- [ ] **Step 3: Write the implementations**

```typescript
// apps/api/src/plugins/gitlab/utils/labels.ts
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "./gitlab-api";

const labelColors: Record<string, string> = {
  "priority:low": "#0EA5E9",
  "priority:medium": "#EAB308",
  "priority:high": "#F97316",
  "priority:urgent": "#EF4444",
  "status:to-do": "#6B7280",
  "status:in-progress": "#3B82F6",
  "status:in-review": "#8B5CF6",
  "status:done": "#10B981",
  "status:planned": "#8B5CF6",
  "status:archived": "#6B7280",
};

function getLabelColor(labelName: string): string {
  return labelColors[labelName] || "#6B7280";
}

export async function ensureLabelsExistGitlab(
  config: GitlabConfig,
  labels: string[],
): Promise<void> {
  const client = createGitlabClient(config);

  let existingLabels: Array<{ name: string }>;
  try {
    existingLabels = await client.listLabels(config.repositoryPath);
  } catch (error) {
    console.error("Failed to list GitLab labels for ensureLabelsExistGitlab", {
      repositoryPath: config.repositoryPath,
      error,
    });
    return;
  }

  const existingNames = new Set(existingLabels.map((l) => l.name));

  for (const name of labels) {
    if (existingNames.has(name)) continue;
    try {
      await client.createLabel(
        config.repositoryPath,
        name,
        getLabelColor(name),
      );
      existingNames.add(name);
    } catch (error) {
      console.error(`Failed to ensure GitLab label "${name}":`, error);
    }
  }
}

export async function addLabelsToIssueGitlab(
  config: GitlabConfig,
  issueIid: number,
  labelNames: string[],
) {
  if (labelNames.length === 0) return;

  await ensureLabelsExistGitlab(config, labelNames);

  const client = createGitlabClient(config);
  try {
    await client.updateIssue(config.repositoryPath, issueIid, {
      add_labels: labelNames.join(","),
    });
  } catch (error) {
    console.error("Failed to add labels to GitLab issue:", error);
  }
}

export async function removeLabelGitlab(
  config: GitlabConfig,
  issueIid: number,
  labelName: string,
) {
  const client = createGitlabClient(config);
  try {
    await client.updateIssue(config.repositoryPath, issueIid, {
      remove_labels: labelName,
    });
  } catch (error) {
    console.error("Failed to remove label from GitLab issue:", {
      repositoryPath: config.repositoryPath,
      issueIid,
      labelName,
      error,
    });
  }
}
```

```typescript
// apps/api/src/plugins/gitlab/utils/sync-label-to-gitlab.ts
import { eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "./gitlab-api";

const namedColorToHex: Record<string, string> = {
  red: "#EF4444",
  orange: "#F97316",
  amber: "#F59E0B",
  yellow: "#EAB308",
  lime: "#84CC16",
  green: "#22C55E",
  emerald: "#10B981",
  teal: "#14B8A6",
  cyan: "#06B6D4",
  sky: "#0EA5E9",
  blue: "#3B82F6",
  indigo: "#6366F1",
  violet: "#8B5CF6",
  purple: "#A855F7",
  fuchsia: "#D946EF",
  pink: "#EC4899",
  rose: "#F43F5E",
  gray: "#6B7280",
  slate: "#64748B",
  zinc: "#71717A",
  neutral: "#737373",
  stone: "#78716C",
};

function toHexColor(color: string): string {
  const lower = color.toLowerCase().replace(/^#/, "");
  if (namedColorToHex[lower]) {
    return namedColorToHex[lower];
  }
  if (/^[0-9a-f]{6}$/i.test(lower)) {
    return `#${lower}`;
  }
  if (/^[0-9a-f]{3}$/i.test(lower)) {
    const [r, g, b] = lower.split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#6B7280";
}

async function getGitlabIssueContext(taskId: string) {
  const externalLinks = await db.query.externalLinkTable.findMany({
    where: eq(externalLinkTable.taskId, taskId),
    with: {
      integration: true,
    },
  });

  const externalLink = externalLinks.find(
    (link) =>
      link.resourceType === "issue" && link.integration?.type === "gitlab",
  );

  if (!externalLink) {
    return null;
  }

  const integration = externalLink.integration;
  if (!integration) {
    return null;
  }

  let config: GitlabConfig;
  try {
    config = JSON.parse(integration.config) as GitlabConfig;
  } catch {
    return null;
  }

  if (!config.accessToken || !config.baseUrl) {
    return null;
  }

  const client = createGitlabClient(config);
  const issueIid = Number.parseInt(externalLink.externalId, 10);
  if (Number.isNaN(issueIid)) {
    console.warn("Invalid GitLab issue externalId for label sync", {
      externalLinkId: externalLink.id,
      externalId: externalLink.externalId,
      taskId,
    });
    return null;
  }

  return {
    client,
    config,
    issueIid,
  };
}

export async function syncLabelToGitlab(
  taskId: string,
  labelName: string,
  labelColor: string,
) {
  const ctx = await getGitlabIssueContext(taskId);
  if (!ctx) return;

  const { client, config, issueIid } = ctx;
  const color = toHexColor(labelColor);

  const labels = await client.listLabels(config.repositoryPath);
  const label = labels.find((l) => l.name === labelName);

  if (!label) {
    try {
      await client.createLabel(config.repositoryPath, labelName, color);
    } catch (error) {
      console.error(`Failed to create label "${labelName}" in GitLab:`, error);
      return;
    }
  }

  try {
    const issue = await client.getIssue(config.repositoryPath, issueIid);
    if ((issue.labels ?? []).includes(labelName)) {
      return;
    }
    await client.updateIssue(config.repositoryPath, issueIid, {
      add_labels: labelName,
    });
  } catch (error) {
    console.error(`Failed to add label "${labelName}" to GitLab issue:`, error);
  }
}

export async function removeLabelFromGitlab(taskId: string, labelName: string) {
  const ctx = await getGitlabIssueContext(taskId);
  if (!ctx) return;

  const { client, config, issueIid } = ctx;

  try {
    const issue = await client.getIssue(config.repositoryPath, issueIid);
    if (!(issue.labels ?? []).includes(labelName)) {
      return;
    }
    await client.updateIssue(config.repositoryPath, issueIid, {
      remove_labels: labelName,
    });
  } catch (error) {
    console.error(
      `Failed to remove label "${labelName}" from GitLab issue:`,
      error,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kaneo/api test:unit -- plugins/gitlab/labels`
Expected: PASS

- [ ] **Step 5: Wire the outbound sync into the label/task controllers**

In each of the four files below, add the GitLab sync call alongside the existing Gitea one (same fire-and-forget `.catch()` pattern, same call sites).

`apps/api/src/label/controllers/create-label.ts` — add the import and call next to the Gitea one:

```typescript
import { syncLabelToGitlab } from "../../plugins/gitlab/utils/sync-label-to-gitlab";
```

```typescript
      syncLabelToGitea(taskId, name, color).catch((error) => {
        console.error("Failed to sync label to Gitea:", error);
      });
      syncLabelToGitlab(taskId, name, color).catch((error) => {
        console.error("Failed to sync label to GitLab:", error);
      });
```

`apps/api/src/label/controllers/delete-label.ts` — add the import, then two call sites (task-level delete and workspace-level cascade):

```typescript
import { removeLabelFromGitlab } from "../../plugins/gitlab/utils/sync-label-to-gitlab";
```

```typescript
    if (deletedLabel.taskId) {
      removeLabelFromGitHub(deletedLabel.taskId, deletedLabel.name).catch(
        (error) => {
          console.error("Failed to remove label from GitHub:", error);
        },
      );
      removeLabelFromGitlab(deletedLabel.taskId, deletedLabel.name).catch(
        (error) => {
          console.error("Failed to remove label from GitLab:", error);
        },
      );
    }
```

```typescript
      removeLabelFromGitea(l.taskId, l.name).catch((error) => {
        console.error("Failed to remove label from Gitea:", error);
      });
      removeLabelFromGitlab(l.taskId, l.name).catch((error) => {
        console.error("Failed to remove label from GitLab:", error);
      });
```

`apps/api/src/label/controllers/assign-label-to-task.ts` — add the import and two call sites (unassign-from-previous-task, assign-to-new-task):

```typescript
import {
  removeLabelFromGitlab,
  syncLabelToGitlab,
} from "../../plugins/gitlab/utils/sync-label-to-gitlab";
```

```typescript
  if (previousTaskId) {
    removeLabelFromGitHub(previousTaskId, previousName).catch((error) => {
      console.error("Failed to remove label from GitHub:", error);
    });
    removeLabelFromGitea(previousTaskId, previousName).catch((error) => {
      console.error("Failed to remove label from Gitea:", error);
    });
    removeLabelFromGitlab(previousTaskId, previousName).catch((error) => {
      console.error("Failed to remove label from GitLab:", error);
    });
  }
```

```typescript
  syncLabelToGitHub(taskId, taskLabel.name, taskLabel.color).catch((error) => {
    console.error("Failed to sync label to GitHub:", error);
  });
  syncLabelToGitea(taskId, taskLabel.name, taskLabel.color).catch((error) => {
    console.error("Failed to sync label to Gitea:", error);
  });
  syncLabelToGitlab(taskId, taskLabel.name, taskLabel.color).catch((error) => {
    console.error("Failed to sync label to GitLab:", error);
  });
```

`apps/api/src/task/controllers/bulk-update-tasks.ts` — add the import and one call site:

```typescript
import { removeLabelFromGitlab } from "../../plugins/gitlab/utils/sync-label-to-gitlab";
```

```typescript
        removeLabelFromGitea(deletedLabel.taskId, deletedLabel.name).catch(
          (error) => {
            console.error("Failed to remove label from Gitea:", error);
          },
        );
        removeLabelFromGitlab(deletedLabel.taskId, deletedLabel.name).catch(
          (error) => {
            console.error("Failed to remove label from GitLab:", error);
          },
        );
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @kaneo/api exec tsc --noEmit`
Expected: no new errors from the four modified files.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/plugins/gitlab/utils/labels.ts apps/api/src/plugins/gitlab/utils/sync-label-to-gitlab.ts apps/api/src/label/controllers/create-label.ts apps/api/src/label/controllers/delete-label.ts apps/api/src/label/controllers/assign-label-to-task.ts apps/api/src/task/controllers/bulk-update-tasks.ts tests/api/plugins/gitlab/labels.test.ts
git commit -m "feat(api): sync Kaneo labels to GitLab issues"
```

---

### Task 6: Integration CRUD + verify + repository listing controllers

**Files:**
- Create: `apps/api/src/gitlab-integration/controllers/create-gitlab-integration.ts`
- Create: `apps/api/src/gitlab-integration/controllers/get-gitlab-integration.ts`
- Create: `apps/api/src/gitlab-integration/controllers/delete-gitlab-integration.ts`
- Create: `apps/api/src/gitlab-integration/controllers/list-gitlab-repositories.ts`
- Create: `apps/api/src/gitlab-integration/controllers/verify-gitlab-access.ts`
- Test: `tests/api/gitlab-integration/verify-gitlab-access.test.ts`

**Interfaces:**
- Consumes: `createGitlabClient`, `GitlabApiError`, `verifyGitlabToken` (Task 2); `normalizeGitlabBaseUrl`, `validateGitlabConfig`, `getDefaultGitlabConfig`, `defaultGitlabConfig`, `type GitlabConfig` (Task 1); `normalizeApiServerUrl` from `apps/api/src/utils/openapi-spec.ts` (existing, unmodified).
- Produces: `createGitlabIntegration({projectId, baseUrl, accessToken, repositoryPath}): Promise<{...}>` (default export), `getGitlabIntegration(projectId, includeWebhookSecret?): Promise<{...} | null>` (default export), `deleteGitlabIntegration(projectId): Promise<{success, message}>` (default export), `listGitlabRepositories({baseUrl, accessToken}): Promise<{repositories: ProjectRow[]}>` (default export), `verifyGitlabAccess({baseUrl, accessToken, repositoryPath}): Promise<{isInstalled, hasRequiredPermissions, repositoryExists, repositoryPrivate, missingPermissions, message, failureReason}>` (default export, `failureReason: "not_a_gitlab_instance" | "redirected" | "repository_not_found" | null`). Task 7's router imports all five; Task 8's import controller reuses the same config-parsing shape.

GitLab identifies a project by a single `repositoryPath` (not owner+name), and `GET /projects/:id` returns a `permissions` object with `project_access`/`group_access`, each an `{access_level: number}` — access level 30 is "Developer", the minimum needed to manage issues, so `verifyGitlabAccess` checks `access_level >= 30` where Gitea checked `admin || push` booleans.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/gitlab-integration/verify-gitlab-access.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGitlabFetch } = vi.hoisted(() => ({
  mockGitlabFetch: vi.fn(),
}));

type GitlabApiErrorKind =
  | "REDIRECT"
  | "INVALID_JSON"
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "EMPTY_RESPONSE";

class GitlabApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public kind: GitlabApiErrorKind,
    public body?: string,
  ) {
    super(message);
    this.name = "GitlabApiError";
  }
}

vi.mock("../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  GitlabApiError,
  gitlabFetch: (...args: unknown[]) => mockGitlabFetch(...args),
  createGitlabClient: () => ({
    getProject: (...args: unknown[]) => mockGitlabFetch(...args),
  }),
  verifyGitlabToken: (...args: unknown[]) => mockGitlabFetch(...args),
}));

const { default: verifyGitlabAccess } = await import(
  "../../../apps/api/src/gitlab-integration/controllers/verify-gitlab-access"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyGitlabAccess", () => {
  it("returns success when the token has Developer+ access", async () => {
    mockGitlabFetch
      .mockResolvedValueOnce({ id: 1, username: "owner" })
      .mockResolvedValueOnce({
        id: 42,
        path_with_namespace: "group/project",
        web_url: "https://gitlab.example/group/project",
        visibility: "private",
        permissions: {
          project_access: { access_level: 30 },
          group_access: null,
        },
      });

    const result = await verifyGitlabAccess({
      baseUrl: "https://gitlab.example",
      accessToken: "token",
      repositoryPath: "group/project",
    });

    expect(result).toMatchObject({
      isInstalled: true,
      hasRequiredPermissions: true,
      repositoryExists: true,
      repositoryPrivate: true,
      missingPermissions: [],
      message: "Token can access the project.",
      failureReason: null,
    });
  });

  it("flags insufficient permissions below Developer access", async () => {
    mockGitlabFetch
      .mockResolvedValueOnce({ id: 1, username: "owner" })
      .mockResolvedValueOnce({
        id: 42,
        path_with_namespace: "group/project",
        web_url: "https://gitlab.example/group/project",
        visibility: "public",
        permissions: {
          project_access: { access_level: 10 },
          group_access: null,
        },
      });

    const result = await verifyGitlabAccess({
      baseUrl: "https://gitlab.example",
      accessToken: "token",
      repositoryPath: "group/project",
    });

    expect(result.hasRequiredPermissions).toBe(false);
    expect(result.missingPermissions).toEqual(["issues (write)"]);
  });

  it("returns a redirect-specific message when the URL redirects", async () => {
    mockGitlabFetch.mockRejectedValue(
      new GitlabApiError(
        "GitLab request was redirected (HTTP 308)",
        308,
        "REDIRECT",
      ),
    );

    const result = await verifyGitlabAccess({
      baseUrl: "http://gitlab.example",
      accessToken: "token",
      repositoryPath: "group/project",
    });

    expect(result.isInstalled).toBe(false);
    expect(result.failureReason).toBe("redirected");
    expect(result.message).toContain("HTTP 308");
  });

  it("returns 'not a GitLab instance' when the response is invalid JSON", async () => {
    mockGitlabFetch.mockRejectedValue(
      new GitlabApiError("GitLab API returned invalid JSON", 200, "INVALID_JSON"),
    );

    const result = await verifyGitlabAccess({
      baseUrl: "https://not-gitlab.example",
      accessToken: "token",
      repositoryPath: "group/project",
    });

    expect(result.isInstalled).toBe(false);
    expect(result.failureReason).toBe("not_a_gitlab_instance");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kaneo/api test:unit -- verify-gitlab-access`
Expected: FAIL — controllers do not exist yet.

- [ ] **Step 3: Write the implementations**

```typescript
// apps/api/src/gitlab-integration/controllers/create-gitlab-integration.ts
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import {
  type GitlabConfig,
  getDefaultGitlabConfig,
  normalizeGitlabBaseUrl,
  validateGitlabConfig,
} from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  GitlabApiError,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";

async function createGitlabIntegration({
  projectId,
  baseUrl,
  accessToken,
  repositoryPath,
}: {
  projectId: string;
  baseUrl: string;
  accessToken: string | undefined;
  repositoryPath: string;
}) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const normalizedBase = normalizeGitlabBaseUrl(baseUrl);

  const existingIntegration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitlab"),
    ),
  });

  let resolvedToken = accessToken?.trim() ?? "";
  if (!resolvedToken && existingIntegration) {
    try {
      const prev = JSON.parse(existingIntegration.config) as GitlabConfig;
      resolvedToken = prev.accessToken;
    } catch (error) {
      console.warn("Failed to parse existing GitLab integration config", {
        integrationId: existingIntegration.id,
        error,
      });
    }
  }

  if (!resolvedToken) {
    throw new HTTPException(400, {
      message: "Personal access token is required",
    });
  }

  try {
    await verifyGitlabToken(normalizedBase, resolvedToken);

    const client = createGitlabClient({
      baseUrl: normalizedBase,
      accessToken: resolvedToken,
    });
    await client.getProject(repositoryPath);
  } catch (error) {
    if (error instanceof GitlabApiError) {
      throw new HTTPException((error.status || 400) as ContentfulStatusCode, {
        message: error.message,
      });
    }
    throw error;
  }

  const allGitlab = await db.query.integrationTable.findMany({
    where: eq(integrationTable.type, "gitlab"),
  });

  for (const integration of allGitlab) {
    if (integration.projectId === projectId) {
      continue;
    }
    if (!integration.isActive) {
      continue;
    }
    try {
      const cfg = JSON.parse(integration.config) as {
        baseUrl?: string;
        repositoryPath?: string;
      };
      if (
        normalizeGitlabBaseUrl(cfg.baseUrl ?? "") === normalizedBase &&
        cfg.repositoryPath === repositoryPath
      ) {
        throw new HTTPException(409, {
          message: `Project ${repositoryPath} on this GitLab instance is already linked to another project`,
        });
      }
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      console.warn(
        "Skipping invalid GitLab integration config during conflict check",
        {
          integrationId: integration.id,
          error,
        },
      );
    }
  }

  let webhookSecret = randomBytes(24).toString("hex");
  if (existingIntegration) {
    try {
      const previousConfig = JSON.parse(
        existingIntegration.config,
      ) as GitlabConfig;
      webhookSecret = previousConfig.webhookSecret ?? webhookSecret;
    } catch (error) {
      console.warn(
        "Failed to parse existing GitLab config for webhook secret",
        {
          integrationId: existingIntegration.id,
          error,
        },
      );
    }
  }

  const config: GitlabConfig = getDefaultGitlabConfig(
    normalizedBase,
    resolvedToken,
    repositoryPath,
    webhookSecret,
  );

  const validation = await validateGitlabConfig(config);
  if (!validation.valid) {
    throw new HTTPException(400, {
      message: validation.errors?.join(", ") ?? "Invalid config",
    });
  }

  if (existingIntegration) {
    const [updated] = await db
      .update(integrationTable)
      .set({
        config: JSON.stringify(config),
        isActive: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(integrationTable.projectId, projectId),
          eq(integrationTable.type, "gitlab"),
        ),
      )
      .returning();

    if (!updated) {
      throw new HTTPException(500, {
        message: "Failed to update GitLab integration",
      });
    }

    return {
      id: updated.id,
      projectId: updated.projectId,
      baseUrl: normalizedBase,
      repositoryPath,
      webhookSecret,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  const [newIntegration] = await db
    .insert(integrationTable)
    .values({
      projectId,
      type: "gitlab",
      config: JSON.stringify(config),
      isActive: true,
    })
    .returning();

  if (!newIntegration) {
    throw new HTTPException(500, {
      message: "Failed to create GitLab integration",
    });
  }

  return {
    id: newIntegration.id,
    projectId: newIntegration.projectId,
    baseUrl: normalizedBase,
    repositoryPath,
    webhookSecret,
    isActive: newIntegration.isActive,
    createdAt: newIntegration.createdAt,
    updatedAt: newIntegration.updatedAt,
  };
}

export default createGitlabIntegration;
```

```typescript
// apps/api/src/gitlab-integration/controllers/get-gitlab-integration.ts
import { and, eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import {
  defaultGitlabConfig,
  type GitlabConfig,
} from "../../plugins/gitlab/config";
import { normalizeApiServerUrl } from "../../utils/openapi-spec";

function maskToken(token: string): string {
  if (token.length <= 8) {
    return "••••••••";
  }
  return `${token.slice(0, 4)}••••••${token.slice(-4)}`;
}

async function getGitlabIntegration(
  projectId: string,
  includeWebhookSecret = false,
) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitlab"),
    ),
  });

  if (!integration) {
    return null;
  }

  const config = JSON.parse(integration.config) as GitlabConfig;

  const apiBase = normalizeApiServerUrl(
    process.env.KANEO_API_URL || "http://localhost:1337",
  );

  return {
    id: integration.id,
    projectId: integration.projectId,
    baseUrl: config.baseUrl,
    repositoryPath: config.repositoryPath,
    maskedAccessToken: maskToken(config.accessToken),
    webhookUrl: `${apiBase.replace(/\/$/, "")}/gitlab-integration/webhook/${integration.id}`,
    webhookSecret: includeWebhookSecret ? (config.webhookSecret ?? "") : "",
    branchPattern: config.branchPattern || defaultGitlabConfig.branchPattern,
    commentTaskLinkOnGitlabIssue:
      config.commentTaskLinkOnGitlabIssue !== false,
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

export default getGitlabIntegration;
```

```typescript
// apps/api/src/gitlab-integration/controllers/delete-gitlab-integration.ts
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable } from "../../database/schema";

async function deleteGitlabIntegration(projectId: string) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitlab"),
    ),
  });

  if (!integration) {
    throw new HTTPException(404, { message: "GitLab integration not found" });
  }

  await db
    .delete(integrationTable)
    .where(
      and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "gitlab"),
      ),
    );

  return { success: true, message: "GitLab integration deleted" };
}

export default deleteGitlabIntegration;
```

```typescript
// apps/api/src/gitlab-integration/controllers/list-gitlab-repositories.ts
import { HTTPException } from "hono/http-exception";
import { normalizeGitlabBaseUrl } from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";

type ProjectRow = {
  id: number;
  name: string;
  path_with_namespace: string;
  visibility: string;
  web_url: string;
};

async function listGitlabRepositories({
  baseUrl,
  accessToken,
}: {
  baseUrl: string;
  accessToken: string;
}): Promise<{ repositories: ProjectRow[] }> {
  const normalized = normalizeGitlabBaseUrl(baseUrl);

  try {
    await verifyGitlabToken(normalized, accessToken);
  } catch {
    throw new HTTPException(401, {
      message: "Invalid GitLab token or could not reach instance.",
    });
  }

  const client = createGitlabClient({
    baseUrl: normalized,
    accessToken,
  });

  const all: ProjectRow[] = [];
  let page = 1;

  while (true) {
    const batch = await client.listUserProjects(page, 50);
    if (!batch.length) break;

    all.push(...batch);

    if (batch.length < 50) break;
    page += 1;
    if (page > 50) break;
  }

  return { repositories: all };
}

export default listGitlabRepositories;
```

```typescript
// apps/api/src/gitlab-integration/controllers/verify-gitlab-access.ts
import { HTTPException } from "hono/http-exception";
import { normalizeGitlabBaseUrl } from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  GitlabApiError,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";

// GitLab access levels: 10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner.
// Developer is the minimum level that can create/edit issues.
const DEVELOPER_ACCESS_LEVEL = 30;

async function verifyGitlabAccess({
  baseUrl,
  accessToken,
  repositoryPath,
}: {
  baseUrl: string;
  accessToken: string;
  repositoryPath: string;
}) {
  try {
    const normalized = normalizeGitlabBaseUrl(baseUrl);
    try {
      await verifyGitlabToken(normalized, accessToken);
    } catch (error) {
      // A 404 from /user means the URL does not point at a GitLab instance
      // (or the token endpoint is misrouted), not a project lookup failure.
      if (error instanceof GitlabApiError && error.status === 404) {
        return {
          isInstalled: false,
          hasRequiredPermissions: false,
          repositoryExists: false,
          repositoryPrivate: null,
          missingPermissions: [] as string[],
          message: "The URL does not point to a GitLab instance.",
          failureReason: "not_a_gitlab_instance",
        };
      }
      throw error;
    }

    const client = createGitlabClient({
      baseUrl: normalized,
      accessToken,
    });

    const repo = await client.getProject(repositoryPath);

    const accessLevel = Math.max(
      repo.permissions?.project_access?.access_level ?? 0,
      repo.permissions?.group_access?.access_level ?? 0,
    );
    const hasIssuesWrite = accessLevel >= DEVELOPER_ACCESS_LEVEL;

    return {
      isInstalled: true,
      hasRequiredPermissions: hasIssuesWrite,
      repositoryExists: true,
      repositoryPrivate: repo.visibility !== "public",
      missingPermissions: hasIssuesWrite ? [] : ["issues (write)"],
      message: hasIssuesWrite
        ? "Token can access the project."
        : "Token may not have sufficient permissions to manage issues.",
      failureReason: null,
    };
  } catch (error) {
    const err = error as { status?: number; message?: string };

    if (error instanceof GitlabApiError) {
      if (error.kind === "REDIRECT") {
        return {
          isInstalled: false,
          hasRequiredPermissions: false,
          repositoryExists: false,
          repositoryPrivate: null,
          missingPermissions: [] as string[],
          message: `The GitLab URL redirected (HTTP ${error.status}). This usually means the server forces HTTPS. Please use the final URL directly.`,
          failureReason: "redirected",
        };
      }

      if (error.kind === "INVALID_JSON") {
        return {
          isInstalled: false,
          hasRequiredPermissions: false,
          repositoryExists: false,
          repositoryPrivate: null,
          missingPermissions: [] as string[],
          message: "The URL does not point to a GitLab instance.",
          failureReason: "not_a_gitlab_instance",
        };
      }
    }

    if (err.status === 404) {
      return {
        isInstalled: false,
        hasRequiredPermissions: false,
        repositoryExists: false,
        repositoryPrivate: null,
        missingPermissions: [] as string[],
        message: "Project not found or not accessible with this token.",
        failureReason: "repository_not_found",
      };
    }

    if (err.status === 401) {
      throw new HTTPException(401, {
        message: "Invalid GitLab token or unauthorized.",
      });
    }

    throw new HTTPException(500, {
      message:
        error instanceof Error
          ? error.message
          : "Failed to verify GitLab access",
    });
  }
}

export default verifyGitlabAccess;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kaneo/api test:unit -- verify-gitlab-access`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/gitlab-integration/controllers tests/api/gitlab-integration/verify-gitlab-access.test.ts
git commit -m "feat(api): add GitLab integration CRUD, verify, and repository-listing controllers"
```

---

### Task 7: Router, OpenAPI schema, and app registration

**Files:**
- Create: `apps/api/src/gitlab-integration/index.ts`
- Modify: `apps/api/src/schemas.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: all five controllers from Task 6 (`createGitlabIntegration`, `getGitlabIntegration`, `deleteGitlabIntegration`, `listGitlabRepositories`, `verifyGitlabAccess`); `hasWorkspacePermission`, `requireWorkspacePermission` from `apps/api/src/utils/require-workspace-permission.ts` (existing); `workspaceAccess`, `workspaceAccessMiddleware` from `apps/api/src/utils/workspace-access-middleware.ts` (existing).
- Produces: default-exported `gitlabIntegration` Hono router mounted at `/gitlab-integration` (routes: `POST /repositories`, `POST /verify`, `GET /project/:projectId`, `POST /project/:projectId`, `PATCH /project/:projectId`, `DELETE /project/:projectId`); `gitlabIntegrationSchema` (valibot, `apps/api/src/schemas.ts`). Task 8 adds `POST /import-issues` to this same router. Task 14 adds `handleGitlabWebhookRoute` to this same file and wires its route into `apps/api/src/index.ts`.

This step deliberately does **not** yet include the webhook route or an import-issues route — those land in Tasks 8 and 16 once their handlers exist. `PATCH /project/:projectId` only supports toggling `isActive` and `commentTaskLinkOnGitlabIssue` here, mirroring Gitea's PATCH surface exactly.

- [ ] **Step 1: Add `gitlabIntegrationSchema` to `apps/api/src/schemas.ts`**

Add directly after the existing `giteaIntegrationSchema` block:

```typescript
export const gitlabIntegrationSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  baseUrl: v.string(),
  repositoryPath: v.string(),
  maskedAccessToken: v.string(),
  webhookUrl: v.optional(v.string()),
  webhookSecret: v.optional(v.string()),
  branchPattern: v.optional(v.string()),
  commentTaskLinkOnGitlabIssue: v.optional(v.boolean()),
  isActive: v.nullable(v.boolean()),
  createdAt: v.date(),
  updatedAt: v.date(),
});
```

- [ ] **Step 2: Write `apps/api/src/gitlab-integration/index.ts`**

```typescript
// apps/api/src/gitlab-integration/index.ts
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { integrationTable } from "../database/schema";
import {
  type GitlabConfig,
  validateGitlabConfig,
} from "../plugins/gitlab/config";
import { gitlabIntegrationSchema } from "../schemas";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import {
  workspaceAccess,
  workspaceAccessMiddleware,
} from "../utils/workspace-access-middleware";
import createGitlabIntegration from "./controllers/create-gitlab-integration";
import deleteGitlabIntegration from "./controllers/delete-gitlab-integration";
import getGitlabIntegration from "./controllers/get-gitlab-integration";
import listGitlabRepositories from "./controllers/list-gitlab-repositories";
import verifyGitlabAccess from "./controllers/verify-gitlab-access";

const gitlabRepositorySchema = v.object({
  id: v.number(),
  name: v.string(),
  path_with_namespace: v.string(),
  visibility: v.string(),
  web_url: v.string(),
});

const verificationResultSchema = v.object({
  isInstalled: v.boolean(),
  hasRequiredPermissions: v.boolean(),
  repositoryExists: v.boolean(),
  repositoryPrivate: v.nullable(v.boolean()),
  missingPermissions: v.array(v.string()),
  message: v.string(),
  failureReason: v.nullable(
    v.picklist(["not_a_gitlab_instance", "redirected", "repository_not_found"]),
  ),
});

const nullableGitlabIntegrationSchema = v.nullable(gitlabIntegrationSchema);

const gitlabIntegration = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
    apiKey?: {
      id: string;
      userId: string;
      enabled: boolean;
    };
  };
}>()
  .post(
    "/repositories",
    describeRoute({
      operationId: "listGitlabRepositories",
      tags: ["GitLab"],
      description: "List projects accessible with a GitLab token",
      responses: {
        200: {
          description: "Repositories",
          content: {
            "application/json": {
              schema: resolver(
                v.object({
                  repositories: v.array(gitlabRepositorySchema),
                }),
              ),
            },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        projectId: v.pipe(v.string(), v.minLength(1)),
        baseUrl: v.pipe(v.string(), v.url()),
        accessToken: v.pipe(v.string(), v.minLength(1)),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
    async (c) => {
      const { baseUrl, accessToken } = c.req.valid("json");
      const result = await listGitlabRepositories({ baseUrl, accessToken });
      return c.json(result);
    },
  )
  .post(
    "/verify",
    describeRoute({
      operationId: "verifyGitlabAccess",
      tags: ["GitLab"],
      description: "Verify GitLab token and project access",
      responses: {
        200: {
          description: "Verification result",
          content: {
            "application/json": {
              schema: resolver(verificationResultSchema),
            },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        projectId: v.pipe(v.string(), v.minLength(1)),
        baseUrl: v.pipe(v.string(), v.url()),
        accessToken: v.pipe(v.string(), v.minLength(1)),
        repositoryPath: v.pipe(v.string(), v.minLength(1)),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
    async (c) => {
      const body = c.req.valid("json");
      const result = await verifyGitlabAccess(body);
      return c.json(result);
    },
  )
  .get(
    "/project/:projectId",
    describeRoute({
      operationId: "getGitlabIntegration",
      tags: ["GitLab"],
      description: "Get GitLab integration for a project",
      responses: {
        200: {
          description: "GitLab integration details",
          content: {
            "application/json": {
              schema: resolver(nullableGitlabIntegrationSchema),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccessMiddleware({
      sources: [{ type: "lookup", resource: "project", idKey: "projectId" }],
    }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const includeWebhookSecret = await hasWorkspacePermission(c, {
        workspace: ["manage_settings"],
      });
      const integration = await getGitlabIntegration(
        projectId,
        includeWebhookSecret,
      );
      if (!integration) {
        return c.json(null, 200);
      }
      return c.json(integration);
    },
  )
  .post(
    "/project/:projectId",
    describeRoute({
      operationId: "createGitlabIntegration",
      tags: ["GitLab"],
      description: "Create or update GitLab integration for a project",
      responses: {
        200: {
          description: "Integration saved",
          content: {
            "application/json": {
              schema: resolver(gitlabIntegrationSchema),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator(
      "json",
      v.object({
        baseUrl: v.pipe(v.string(), v.minLength(1)),
        accessToken: v.optional(v.string()),
        repositoryPath: v.pipe(v.string(), v.minLength(1)),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const body = c.req.valid("json");
      await createGitlabIntegration({
        projectId,
        baseUrl: body.baseUrl,
        accessToken: body.accessToken,
        repositoryPath: body.repositoryPath,
      });
      const integration = await getGitlabIntegration(projectId, true);
      if (!integration) {
        throw new HTTPException(500, { message: "Failed to load integration" });
      }
      return c.json(integration);
    },
  )
  .patch(
    "/project/:projectId",
    describeRoute({
      operationId: "updateGitlabIntegration",
      tags: ["GitLab"],
      description: "Update GitLab integration settings",
      responses: {
        200: {
          description: "Updated",
          content: {
            "application/json": {
              schema: resolver(gitlabIntegrationSchema),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator(
      "json",
      v.object({
        isActive: v.optional(v.boolean()),
        commentTaskLinkOnGitlabIssue: v.optional(v.boolean()),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const body = c.req.valid("json");

      const row = await db.query.integrationTable.findFirst({
        where: and(
          eq(integrationTable.projectId, projectId),
          eq(integrationTable.type, "gitlab"),
        ),
      });

      if (!row) {
        return c.json({ error: "Integration not found" }, 404);
      }

      let config: GitlabConfig;
      try {
        config = JSON.parse(row.config) as GitlabConfig;
      } catch {
        throw new HTTPException(500, { message: "Invalid integration config" });
      }

      if (body.commentTaskLinkOnGitlabIssue !== undefined) {
        config = {
          ...config,
          commentTaskLinkOnGitlabIssue: body.commentTaskLinkOnGitlabIssue,
        };
      }

      const validation = await validateGitlabConfig(config);
      if (!validation.valid) {
        throw new HTTPException(400, {
          message: validation.errors?.join(", ") ?? "Invalid config",
        });
      }

      await db
        .update(integrationTable)
        .set({
          config: JSON.stringify(config),
          isActive:
            body.isActive !== undefined
              ? body.isActive
              : (row.isActive ?? true),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(integrationTable.projectId, projectId),
            eq(integrationTable.type, "gitlab"),
          ),
        );

      const updated = await getGitlabIntegration(projectId, true);
      if (!updated) {
        throw new HTTPException(500, { message: "Failed to load integration" });
      }
      return c.json(updated, 200);
    },
  )
  .delete(
    "/project/:projectId",
    describeRoute({
      operationId: "deleteGitlabIntegration",
      tags: ["GitLab"],
      description: "Delete GitLab integration for a project",
      responses: {
        200: {
          description: "Deleted",
          content: {
            "application/json": {
              schema: resolver(
                v.object({
                  success: v.boolean(),
                  message: v.string(),
                }),
              ),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const result = await deleteGitlabIntegration(projectId);
      return c.json(result);
    },
  );

export default gitlabIntegration;
```

- [ ] **Step 3: Register the router in `apps/api/src/index.ts`**

Add the import next to the Gitea one:

```typescript
import gitlabIntegration from "./gitlab-integration";
```

Add the route mount next to `giteaIntegrationApi`:

```typescript
  const gitlabIntegrationApi = api.route(
    "/gitlab-integration",
    gitlabIntegration,
  );
```

Add `gitlabIntegrationApi` to both destructuring lists (`createdApp` return-value destructure and the second one right below it) next to `giteaIntegrationApi`, and add `| typeof gitlabIntegrationApi` to the `AppType` union next to `| typeof giteaIntegrationApi`.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @kaneo/api exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/gitlab-integration/index.ts apps/api/src/schemas.ts apps/api/src/index.ts
git commit -m "feat(api): add GitLab integration router and register it"
```

---

### Task 8: Issue import controller

**Files:**
- Create: `apps/api/src/gitlab-integration/controllers/import-gitlab-issues.ts`
- Modify: `apps/api/src/gitlab-integration/index.ts`
- Test: `tests/api/gitlab-integration/import-gitlab-issues.test.ts`

**Interfaces:**
- Consumes: `createGitlabClient`, `type GitlabIssue`, `type GitlabLabel`, `type GitlabMergeRequest` (Task 2); `type GitlabConfig` (Task 1); `extractTaskNumberGitlab` (Task 4); `createExternalLink`, `findExternalLink` from `plugins/github/services/link-manager` (existing); `findTaskByNumber` from `plugins/github/services/task-service` (existing); `extractIssuePriority`, `extractIssueStatus` from `plugins/github/utils/extract-priority` (existing); `formatTaskDescriptionFromIssue` from `plugins/github/utils/format` (existing).
- Produces: `importGitlabIssues(projectId: string): Promise<{imported: number; updated: number; skipped: number; errors?: string[]}>`. Wired into the router as `POST /gitlab-integration/import-issues`.

Two real deltas from Gitea's importer: (1) GitLab's `/issues` endpoint never returns merge requests, so there is no `issue.pull_request` filter to apply; (2) GitLab issue payloads carry `labels` as plain strings with no color, so label colors are resolved from one `listLabels` call per project rather than being present on each issue.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/gitlab-integration/import-gitlab-issues.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  integrationFindFirst: vi.fn(),
  findExternalLink: vi.fn(),
  createExternalLink: vi.fn(),
  publishEvent: vi.fn(),
  listIssues: vi.fn(),
  listMergeRequests: vi.fn(),
  listLabels: vi.fn(),
  listIssueNotes: vi.fn(),
  insertedTasks: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      projectTable: { findFirst: (...a: unknown[]) => mocks.projectFindFirst(...a) },
      integrationTable: {
        findFirst: (...a: unknown[]) => mocks.integrationFindFirst(...a),
      },
      labelTable: { findMany: async () => [], findFirst: async () => null },
    },
    transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        select: () => ({
          from: () => ({
            where: () => ({
              for: async () => [{ id: "project-1", workspaceId: "ws-1" }],
            }),
          }),
        }),
        insert: () => ({
          values: (values: Record<string, unknown>) => {
            mocks.insertedTasks.push(values);
            return {
              returning: async () => [{ id: "task-1", ...values }],
            };
          },
        }),
      }),
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({ target: [] }),
      }),
    }),
    delete: () => ({ where: async () => undefined }),
  },
}));

vi.mock("../../../apps/api/src/events", () => ({
  publishEvent: (...a: unknown[]) => mocks.publishEvent(...a),
}));

vi.mock(
  "../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    createExternalLink: (...a: unknown[]) => mocks.createExternalLink(...a),
    findExternalLink: (...a: unknown[]) => mocks.findExternalLink(...a),
  }),
);

vi.mock("../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({
    listIssues: (...a: unknown[]) => mocks.listIssues(...a),
    listMergeRequests: (...a: unknown[]) => mocks.listMergeRequests(...a),
    listLabels: (...a: unknown[]) => mocks.listLabels(...a),
    listIssueNotes: (...a: unknown[]) => mocks.listIssueNotes(...a),
  }),
}));

const { importGitlabIssues } = await import(
  "../../../apps/api/src/gitlab-integration/controllers/import-gitlab-issues"
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insertedTasks.length = 0;
  mocks.projectFindFirst.mockResolvedValue({
    id: "project-1",
    workspaceId: "ws-1",
    slug: "kan",
  });
  mocks.integrationFindFirst.mockResolvedValue({
    id: "integration-1",
    isActive: true,
    config: JSON.stringify({
      baseUrl: "https://gitlab.example.com",
      accessToken: "token",
      repositoryPath: "group/project",
    }),
  });
  mocks.findExternalLink.mockResolvedValue(null);
  mocks.createExternalLink.mockResolvedValue({ id: "link-1" });
  mocks.publishEvent.mockResolvedValue(undefined);
  mocks.listLabels.mockResolvedValue([]);
  mocks.listIssueNotes.mockResolvedValue([]);
  mocks.listMergeRequests.mockResolvedValue([]);
});

describe("importGitlabIssues", () => {
  it("imports an open issue with no existing link as a new task", async () => {
    mocks.listIssues.mockResolvedValueOnce([
      {
        id: 1,
        iid: 5,
        title: "Fix login bug",
        description: "Steps to reproduce",
        web_url: "https://gitlab.example.com/group/project/-/issues/5",
        state: "opened",
        labels: [],
        author: { username: "octocat" },
      },
    ]);
    mocks.listIssues.mockResolvedValueOnce([]);

    const result = await importGitlabIssues("project-1");

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mocks.createExternalLink).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "issue",
        externalId: "5",
        url: "https://gitlab.example.com/group/project/-/issues/5",
      }),
    );
  });

  it("skips an issue that already has an external link and reports it as updated", async () => {
    mocks.findExternalLink.mockResolvedValueOnce({ taskId: "task-existing" });
    mocks.listIssues.mockResolvedValueOnce([
      {
        id: 1,
        iid: 5,
        title: "Fix login bug",
        description: "",
        web_url: "https://gitlab.example.com/group/project/-/issues/5",
        state: "opened",
        labels: [],
        author: { username: "octocat" },
      },
    ]);
    mocks.listIssues.mockResolvedValueOnce([]);

    const result = await importGitlabIssues("project-1");

    expect(result.updated).toBe(1);
    expect(result.imported).toBe(0);
    expect(mocks.createExternalLink).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kaneo/api test:unit -- import-gitlab-issues`
Expected: FAIL — `import-gitlab-issues.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/api/src/gitlab-integration/controllers/import-gitlab-issues.ts
import { and, eq, inArray, max, notInArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  integrationTable,
  labelTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import type { GitlabConfig } from "../../plugins/gitlab/config";
import { extractTaskNumberGitlab } from "../../plugins/gitlab/utils/branch-matcher";
import {
  createGitlabClient,
  type GitlabIssue,
  type GitlabLabel,
  type GitlabMergeRequest,
} from "../../plugins/gitlab/utils/gitlab-api";
import {
  createExternalLink,
  findExternalLink,
} from "../../plugins/github/services/link-manager";
import { findTaskByNumber } from "../../plugins/github/services/task-service";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../plugins/github/utils/extract-priority";
import { formatTaskDescriptionFromIssue } from "../../plugins/github/utils/format";

type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors?: string[];
};

export async function importGitlabIssues(
  projectId: string,
): Promise<ImportResult> {
  const errors: string[] = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitlab"),
    ),
  });

  if (!integration) {
    throw new HTTPException(404, { message: "GitLab integration not found" });
  }

  if (!integration.isActive) {
    throw new HTTPException(400, {
      message: "GitLab integration is not active",
    });
  }

  let config: GitlabConfig;
  try {
    config = JSON.parse(integration.config) as GitlabConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Invalid GitLab integration config JSON", {
      integrationId: integration.id,
      error,
    });
    throw new HTTPException(400, {
      message: `Invalid GitLab integration config: ${message}`,
    });
  }

  if (!config.accessToken || !config.baseUrl) {
    throw new HTTPException(400, {
      message: "GitLab access token or base URL not configured",
    });
  }

  const client = createGitlabClient(config);

  // GitLab issue payloads carry label names only, with no color — resolve
  // colors once per project instead of once per issue.
  let labelColors = new Map<string, string>();
  try {
    const projectLabels = await client.listLabels(config.repositoryPath);
    labelColors = new Map(projectLabels.map((l) => [l.name, l.color ?? "#6B7280"]));
  } catch (error) {
    console.warn("Failed to list GitLab labels for import; using defaults", {
      repositoryPath: config.repositoryPath,
      error,
    });
  }

  const allIssues: GitlabIssue[] = [];
  let page = 1;

  while (true) {
    const issues = await client.listIssues(
      config.repositoryPath,
      page,
      "opened",
    );

    if (issues.length === 0) break;

    allIssues.push(...issues);

    if (issues.length < 100) break;
    page++;
  }

  for (const issue of allIssues) {
    try {
      const result = await importSingleIssue(
        issue,
        integration.id,
        projectId,
        project.workspaceId,
        config,
        client,
        labelColors,
      );

      if (result === "imported") {
        imported++;
      } else if (result === "updated") {
        updated++;
      } else {
        skipped++;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`Issue #${issue.iid}: ${errorMessage}`);
    }
  }

  const allMRs: GitlabMergeRequest[] = [];
  page = 1;

  while (true) {
    const mrs = await client.listMergeRequests(config.repositoryPath, page);

    if (mrs.length === 0) break;

    allMRs.push(...mrs);

    if (mrs.length < 100) break;
    page++;
  }

  for (const mr of allMRs) {
    try {
      if (!mr.source_branch) {
        continue;
      }
      await linkMergeRequestToTask(
        mr,
        integration.id,
        projectId,
        project.slug,
        config,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`MR !${mr.iid}: ${errorMessage}`);
    }
  }

  return {
    imported,
    updated,
    skipped,
    ...(errors.length > 0 ? { errors } : {}),
  };
}

async function importSingleIssue(
  issue: GitlabIssue,
  integrationId: string,
  projectId: string,
  workspaceId: string,
  config: GitlabConfig,
  client: ReturnType<typeof createGitlabClient>,
  labelColors: Map<string, string>,
): Promise<"imported" | "updated" | "skipped"> {
  const existingLink = await findExternalLink(
    integrationId,
    "issue",
    issue.iid.toString(),
  );

  const labels = issue.labels ?? [];
  const priority = extractIssuePriority(labels);
  const status = extractIssueStatus(labels);

  if (existingLink) {
    const updateData: Record<string, unknown> = {
      title: issue.title,
      description: formatTaskDescriptionFromIssue(issue.description),
    };

    if (priority) updateData.priority = priority;
    if (status) updateData.status = status;

    await db
      .update(taskTable)
      .set(updateData)
      .where(eq(taskTable.id, existingLink.taskId));

    await importLabelsForTask(labels, labelColors, existingLink.taskId, workspaceId);
    await importNotesForTask(issue.iid, existingLink.taskId, config, client);

    return "updated";
  }

  const createdTask = await db.transaction(async (tx) => {
    const [lockedProject] = await tx
      .select()
      .from(projectTable)
      .where(eq(projectTable.id, projectId))
      .for("update");

    if (!lockedProject) {
      throw new Error("Project not found");
    }

    const [result] = await tx
      .select({ maxNumber: max(taskTable.number) })
      .from(taskTable)
      .where(eq(taskTable.projectId, projectId));

    const nextNumber = (result?.maxNumber ?? 0) + 1;

    const taskValues: typeof taskTable.$inferInsert = {
      projectId,
      userId: null,
      title: issue.title,
      description: formatTaskDescriptionFromIssue(issue.description),
      status: status || "to-do",
      priority: priority ?? "low",
      number: nextNumber,
    };

    const [created] = await tx.insert(taskTable).values(taskValues).returning();

    if (!created) {
      throw new Error("Failed to create task");
    }

    return created;
  });

  await createExternalLink({
    taskId: createdTask.id,
    integrationId,
    resourceType: "issue",
    externalId: issue.iid.toString(),
    url: issue.web_url,
    title: issue.title,
    metadata: {
      state: issue.state,
      createdFrom: "gitlab-import",
      author: issue.author?.username,
    },
  });

  await importLabelsForTask(labels, labelColors, createdTask.id, workspaceId);
  await importNotesForTask(issue.iid, createdTask.id, config, client);

  await publishEvent("task.created", {
    ...createdTask,
    taskId: createdTask.id,
    userId: createdTask.userId ?? "",
    type: "task",
    content: null,
    source: "gitlab-import",
    integrationId,
    externalId: issue.iid.toString(),
  });

  return "imported";
}

async function importLabelsForTask(
  labelNames: string[],
  labelColors: Map<string, string>,
  taskId: string,
  workspaceId: string,
): Promise<void> {
  const nonSystemLabels = labelNames
    .filter((name) => !name.startsWith("priority:") && !name.startsWith("status:"))
    .map((name) => ({
      name,
      color: labelColors.get(name) ?? "#6B7280",
    }));

  const expectedNames = nonSystemLabels.map((label) => label.name);

  if (expectedNames.length > 0) {
    await db
      .delete(labelTable)
      .where(
        and(
          eq(labelTable.taskId, taskId),
          notInArray(labelTable.name, expectedNames),
        ),
      );
  } else {
    await db.delete(labelTable).where(eq(labelTable.taskId, taskId));
  }

  const existingLabelsOnTask = await db.query.labelTable.findMany({
    where:
      expectedNames.length > 0
        ? and(
            eq(labelTable.taskId, taskId),
            inArray(labelTable.name, expectedNames),
          )
        : eq(labelTable.taskId, taskId),
  });

  for (const labelData of nonSystemLabels) {
    const existingLabelOnTask = existingLabelsOnTask.find(
      (label) => label.name === labelData.name,
    );

    if (existingLabelOnTask) {
      continue;
    }

    const existingWorkspaceLabel = await db.query.labelTable.findFirst({
      where: and(
        eq(labelTable.workspaceId, workspaceId),
        eq(labelTable.name, labelData.name),
      ),
    });

    const colorToUse = existingWorkspaceLabel?.color || labelData.color;

    await db
      .insert(labelTable)
      .values({
        name: labelData.name,
        color: colorToUse,
        taskId,
        workspaceId,
      })
      .onConflictDoNothing({
        target: [labelTable.taskId, labelTable.name],
      });
  }
}

async function importNotesForTask(
  issueIid: number,
  taskId: string,
  config: GitlabConfig,
  client: ReturnType<typeof createGitlabClient>,
): Promise<void> {
  const allNotes: Array<{
    id: number;
    body: string;
    author?: { username?: string; avatar_url?: string } | null;
  }> = [];
  let page = 1;

  while (true) {
    const notes = await client.listIssueNotes(
      config.repositoryPath,
      issueIid,
      page,
      100,
    );

    if (notes.length === 0) break;

    allNotes.push(...notes);

    if (notes.length < 100) break;
    page++;
  }

  for (const note of allNotes) {
    const username = note.author?.username ?? "";
    if (username.endsWith("-bot") || username.endsWith("[bot]")) {
      continue;
    }

    await db
      .insert(activityTable)
      .values({
        taskId,
        type: "comment",
        content: note.body,
        externalUserName: username || "Unknown",
        externalUserAvatar: note.author?.avatar_url ?? null,
        externalSource: "gitlab",
        externalUrl: `${config.baseUrl}/${config.repositoryPath}/-/issues/${issueIid}#note_${note.id}`,
        eventData: {
          externalCommentId: note.id,
        },
      })
      .onConflictDoNothing({
        target: [
          activityTable.taskId,
          activityTable.externalSource,
          activityTable.externalUrl,
        ],
      });
  }
}

async function linkMergeRequestToTask(
  mr: GitlabMergeRequest,
  integrationId: string,
  projectId: string,
  projectSlug: string,
  config: GitlabConfig,
): Promise<void> {
  const taskNumber = extractTaskNumberGitlab(
    mr.source_branch,
    mr.title,
    mr.description ?? undefined,
    config,
    projectSlug,
  );

  if (!taskNumber) {
    return;
  }

  const task = await findTaskByNumber(projectId, taskNumber);

  if (!task) {
    return;
  }

  const existingLink = await findExternalLink(
    integrationId,
    "pull_request",
    mr.iid.toString(),
  );

  if (existingLink) {
    return;
  }

  await createExternalLink({
    taskId: task.id,
    integrationId,
    resourceType: "pull_request",
    externalId: mr.iid.toString(),
    url: mr.web_url,
    title: mr.title,
    metadata: {
      state: mr.state,
      branch: mr.source_branch,
      author: mr.author?.username,
    },
  });
}
```

- [ ] **Step 4: Wire the route into `apps/api/src/gitlab-integration/index.ts`**

Add the import:

```typescript
import { importGitlabIssues } from "./controllers/import-gitlab-issues";
```

Add the route (mirrors Gitea's `/import-issues` route exactly — its own auth chain since it accepts a project-scoped API key too, not just a session):

```typescript
  .post(
    "/import-issues",
    describeRoute({
      operationId: "importGitlabIssues",
      tags: ["GitLab"],
      description: "Import GitLab issues as tasks",
      responses: {
        200: {
          description: "Import result",
          content: {
            "application/json": {
              schema: resolver(
                v.object({
                  imported: v.number(),
                  updated: v.number(),
                  skipped: v.number(),
                  errors: v.optional(v.array(v.string())),
                }),
              ),
            },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        projectId: v.string(),
      }),
    ),
    async (c, next) => {
      const userId = c.get("userId");
      if (!userId) {
        throw new HTTPException(401, { message: "Unauthorized" });
      }

      const { projectId } = c.req.valid("json");

      const [project] = await db
        .select({ workspaceId: projectTable.workspaceId })
        .from(projectTable)
        .where(eq(projectTable.id, projectId))
        .limit(1);

      if (!project) {
        throw new HTTPException(404, { message: "Project not found" });
      }

      const apiKey = c.get("apiKey");
      const apiKeyId = apiKey?.id;

      await validateWorkspaceAccess(userId, project.workspaceId, apiKeyId);
      c.set("workspaceId", project.workspaceId);

      return next();
    },
    requireWorkspacePermission({ task: ["create"] }),
    async (c) => {
      const { projectId } = c.req.valid("json");
      const result = await importGitlabIssues(projectId);
      return c.json(result);
    },
  );
```

Add the two extra imports this route needs at the top of the file:

```typescript
import { projectTable } from "../database/schema";
import { validateWorkspaceAccess } from "../utils/validate-workspace-access";
```

(`projectTable` merges into the existing `import { integrationTable } from "../database/schema"` line as `import { integrationTable, projectTable } from "../database/schema";`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @kaneo/api test:unit -- import-gitlab-issues`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/gitlab-integration/controllers/import-gitlab-issues.ts apps/api/src/gitlab-integration/index.ts tests/api/gitlab-integration/import-gitlab-issues.test.ts
git commit -m "feat(api): import GitLab issues and merge requests as tasks"
```

---

### Task 9: Inbound webhook — Push Hook

**Files:**
- Create: `apps/api/src/plugins/gitlab/webhooks/push.ts`
- Test: `tests/api/plugins/gitlab/webhooks/push.test.ts`

**Interfaces:**
- Consumes: `findAllIntegrationsByGitlabProject` (Task 4); `extractTaskNumberFromBranchGitlab` (Task 4); `resolveTargetStatus` (Task 4); `baseUrlFromProjectWebUrl` (Task 4); `type GitlabConfig` (Task 1); `createOrUpdateExternalLink`, `findTaskByNumber`, `isTaskInFinalState`, `updateTaskStatus` from generic `plugins/github/services/*` (existing).
- Produces: `handleGitlabPush(payload, integrationId?): Promise<void>`. Wired into the dispatcher in Task 14.

GitLab's Push Hook payload gives `project.path_with_namespace` and `project.web_url` directly, so the lookup goes straight through `baseUrlFromProjectWebUrl` + `findAllIntegrationsByGitlabProject` — no owner/name split needed. Commits are ordered oldest→newest, same as Gitea, so the head commit is `commits[commits.length - 1]`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/plugins/gitlab/webhooks/push.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAllIntegrationsByGitlabProject: vi.fn(),
  extractTaskNumberFromBranchGitlab: vi.fn(),
  findTaskByNumber: vi.fn(),
  isTaskInFinalState: vi.fn(),
  updateTaskStatus: vi.fn(),
  createOrUpdateExternalLink: vi.fn(),
  resolveTargetStatus: vi.fn(),
  publishEvent: vi.fn(),
}));

vi.mock("../../../../../apps/api/src/events", () => ({
  publishEvent: (...a: unknown[]) => mocks.publishEvent(...a),
}));

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    createOrUpdateExternalLink: (...a: unknown[]) =>
      mocks.createOrUpdateExternalLink(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/task-service",
  () => ({
    findTaskByNumber: (...a: unknown[]) => mocks.findTaskByNumber(...a),
    isTaskInFinalState: (...a: unknown[]) => mocks.isTaskInFinalState(...a),
    updateTaskStatus: (...a: unknown[]) => mocks.updateTaskStatus(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/services/integration-lookup",
  () => ({
    findAllIntegrationsByGitlabProject: (...a: unknown[]) =>
      mocks.findAllIntegrationsByGitlabProject(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/utils/branch-matcher",
  () => ({
    extractTaskNumberFromBranchGitlab: (...a: unknown[]) =>
      mocks.extractTaskNumberFromBranchGitlab(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/utils/resolve-column",
  () => ({
    resolveTargetStatus: (...a: unknown[]) => mocks.resolveTargetStatus(...a),
  }),
);

const { handleGitlabPush } = await import(
  "../../../../../apps/api/src/plugins/gitlab/webhooks/push"
);

const integration = {
  id: "integration-1",
  projectId: "project-1",
  config: JSON.stringify({
    baseUrl: "https://gitlab.example.com",
    statusTransitions: { onBranchPush: "in-progress" },
  }),
};

function pushPayload(ref: string) {
  return {
    ref,
    commits: [
      {
        id: "abc123",
        message: "fix bug",
        author: { name: "octocat" },
        timestamp: "2026-01-01T00:00:00Z",
      },
    ],
    project: {
      path_with_namespace: "group/project",
      web_url: "https://gitlab.example.com/group/project",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findAllIntegrationsByGitlabProject.mockResolvedValue([integration]);
  mocks.extractTaskNumberFromBranchGitlab.mockReturnValue(5);
  mocks.findTaskByNumber.mockResolvedValue({
    id: "task-1",
    status: "to-do",
    columnId: null,
    projectId: "project-1",
  });
  mocks.resolveTargetStatus.mockResolvedValue("in-progress");
  mocks.isTaskInFinalState.mockResolvedValue(false);
  mocks.createOrUpdateExternalLink.mockResolvedValue({ id: "link-1", created: true });
  mocks.updateTaskStatus.mockResolvedValue({
    applied: true,
    before: { status: "to-do" },
    after: { id: "task-1", status: "in-progress", projectId: "project-1", title: "t", userId: null },
  });
});

describe("handleGitlabPush", () => {
  it("skips a non-branch ref", async () => {
    await handleGitlabPush(pushPayload("refs/tags/v1.0.0"));
    expect(mocks.findAllIntegrationsByGitlabProject).not.toHaveBeenCalled();
  });

  it("skips a protected branch", async () => {
    await handleGitlabPush(pushPayload("refs/heads/main"));
    expect(mocks.findAllIntegrationsByGitlabProject).toHaveBeenCalled();
    expect(mocks.createOrUpdateExternalLink).not.toHaveBeenCalled();
  });

  it("links the branch and transitions the task status", async () => {
    await handleGitlabPush(pushPayload("refs/heads/kan-5-fix-bug"));

    expect(mocks.createOrUpdateExternalLink).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        resourceType: "branch",
        externalId: "kan-5-fix-bug",
      }),
    );
    expect(mocks.updateTaskStatus).toHaveBeenCalledWith("task-1", "in-progress");
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({ newStatus: "in-progress" }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kaneo/api test:unit -- plugins/gitlab/webhooks/push`
Expected: FAIL — `plugins/gitlab/webhooks/push.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/api/src/plugins/gitlab/webhooks/push.ts
import { publishEvent } from "../../../events";
import { createOrUpdateExternalLink } from "../../github/services/link-manager";
import {
  findTaskByNumber,
  isTaskInFinalState,
  updateTaskStatus,
} from "../../github/services/task-service";
import type { GitlabConfig } from "../config";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { extractTaskNumberFromBranchGitlab } from "../utils/branch-matcher";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type PushPayload = {
  ref: string;
  commits?: Array<{
    id: string;
    message: string;
    author?: { name: string };
    timestamp?: string;
  }>;
  project: {
    path_with_namespace: string;
    web_url: string;
  };
};

const PROTECTED_BRANCHES = [
  "main",
  "master",
  "develop",
  "staging",
  "production",
];

export async function handleGitlabPush(
  payload: PushPayload,
  integrationId?: string,
) {
  const { ref, project } = payload;

  if (!ref.startsWith("refs/heads/")) {
    console.log(`[GitLab Push] Skipping non-branch ref: ${ref}`);
    return;
  }

  const branchName = ref.slice("refs/heads/".length);
  console.log(`[GitLab Push] Processing branch: ${branchName}`);

  const origin = baseUrlFromProjectWebUrl(
    project.web_url,
    project.path_with_namespace,
  );
  if (!origin) {
    return;
  }

  const integrations = await findAllIntegrationsByGitlabProject(
    origin,
    project.path_with_namespace,
    integrationId,
  );

  if (integrations.length === 0) {
    return;
  }

  if (PROTECTED_BRANCHES.includes(branchName)) {
    console.log(`[GitLab Push] Skipping protected branch: ${branchName}`);
    return;
  }

  const headCommit = payload.commits?.[payload.commits.length - 1];

  for (const integration of integrations) {
    if (!integration.project) {
      continue;
    }

    let config: GitlabConfig;
    try {
      config = JSON.parse(integration.config) as GitlabConfig;
    } catch (error) {
      console.error("Invalid GitLab integration config for push webhook", {
        integrationId: integration.id,
        error,
      });
      continue;
    }
    const projectSlug = integration.project.slug;

    const taskNumber = extractTaskNumberFromBranchGitlab(
      branchName,
      config,
      projectSlug,
    );

    if (!taskNumber) {
      continue;
    }

    const task = await findTaskByNumber(integration.projectId, taskNumber);

    if (!task) {
      continue;
    }

    const treeUrl = `${project.web_url}/-/tree/${branchName}`;

    await createOrUpdateExternalLink({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "branch",
      externalId: branchName,
      url: treeUrl,
      title: branchName,
      metadata: {
        lastCommit: headCommit
          ? {
              sha: headCommit.id,
              message: headCommit.message,
              author: headCommit.author?.name,
              timestamp: headCommit.timestamp,
            }
          : null,
      },
    });

    const targetStatus = await resolveTargetStatus(
      integration.projectId,
      "branch_push",
      config.statusTransitions?.onBranchPush || "in-progress",
    );

    const isTaskFinal = await isTaskInFinalState(task);

    if (task.status !== targetStatus && !isTaskFinal) {
      const statusResult = await updateTaskStatus(task.id, targetStatus);
      if (
        statusResult.applied &&
        statusResult.before.status !== statusResult.after.status
      ) {
        await publishEvent("task.status_changed", {
          taskId: statusResult.after.id,
          projectId: statusResult.after.projectId,
          userId: null,
          oldStatus: statusResult.before.status,
          newStatus: statusResult.after.status,
          title: statusResult.after.title,
          assigneeId: statusResult.after.userId,
          type: "status_changed",
        });
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kaneo/api test:unit -- plugins/gitlab/webhooks/push`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/plugins/gitlab/webhooks/push.ts tests/api/plugins/gitlab/webhooks/push.test.ts
git commit -m "feat(api): handle GitLab push webhook events"
```

---

### Task 10: Inbound webhooks — Merge Request Hook (open, close/merge)

**Files:**
- Create: `apps/api/src/plugins/gitlab/webhooks/merge-request-opened.ts`
- Create: `apps/api/src/plugins/gitlab/webhooks/merge-request-closed.ts`
- Test: `tests/api/plugins/gitlab/webhooks/merge-request-closed.test.ts`

**Interfaces:**
- Consumes: same as Task 9, plus `extractTaskNumberGitlab` (Task 4), `findExternalLink`, `updateExternalLink` (`plugins/github/services/link-manager`), `findTaskById` (`plugins/github/services/task-service`).
- Produces: `handleGitlabMergeRequestOpened(payload, integrationId?): Promise<void>`, `handleGitlabMergeRequestClosed(payload, integrationId?): Promise<void>`.

GitLab's Merge Request Hook uses `object_attributes.action` (`"open"|"reopen"|"close"|"merge"|"update"|...`) and `object_attributes.state` (`"opened"|"closed"|"merged"|"locked"`) — the merge-vs-plain-close distinction Gitea gets from a `merged: boolean` field on the PR object comes from `object_attributes.state === "merged"` here.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/plugins/gitlab/webhooks/merge-request-closed.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAllIntegrationsByGitlabProject: vi.fn(),
  findTaskById: vi.fn(),
  updateTaskStatus: vi.fn(),
  updateExternalLink: vi.fn(),
  resolveTargetStatus: vi.fn(),
  publishEvent: vi.fn(),
  externalLinkFindFirst: vi.fn(),
  externalLinkFindMany: vi.fn(),
}));

vi.mock("../../../../../apps/api/src/database", () => ({
  default: {
    query: {
      externalLinkTable: {
        findFirst: (...a: unknown[]) => mocks.externalLinkFindFirst(...a),
        findMany: (...a: unknown[]) => mocks.externalLinkFindMany(...a),
      },
    },
  },
}));

vi.mock("../../../../../apps/api/src/events", () => ({
  publishEvent: (...a: unknown[]) => mocks.publishEvent(...a),
}));

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    updateExternalLink: (...a: unknown[]) => mocks.updateExternalLink(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/task-service",
  () => ({
    findTaskById: (...a: unknown[]) => mocks.findTaskById(...a),
    updateTaskStatus: (...a: unknown[]) => mocks.updateTaskStatus(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/services/integration-lookup",
  () => ({
    findAllIntegrationsByGitlabProject: (...a: unknown[]) =>
      mocks.findAllIntegrationsByGitlabProject(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/utils/resolve-column",
  () => ({
    resolveTargetStatus: (...a: unknown[]) => mocks.resolveTargetStatus(...a),
  }),
);

const { handleGitlabMergeRequestClosed } = await import(
  "../../../../../apps/api/src/plugins/gitlab/webhooks/merge-request-closed"
);

const integration = {
  id: "integration-1",
  projectId: "project-1",
  config: JSON.stringify({ statusTransitions: { onMRMerge: "done" } }),
};

function mrClosedPayload(state: "closed" | "merged") {
  return {
    object_attributes: {
      iid: 9,
      title: "Fix bug",
      state,
      action: state === "merged" ? "merge" : "close",
      source_branch: "kan-5-fix-bug",
    },
    project: {
      path_with_namespace: "group/project",
      web_url: "https://gitlab.example.com/group/project",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findAllIntegrationsByGitlabProject.mockResolvedValue([integration]);
  mocks.externalLinkFindFirst.mockResolvedValue({
    id: "link-1",
    taskId: "task-1",
    metadata: null,
  });
  mocks.externalLinkFindMany.mockResolvedValue([]);
  mocks.findTaskById.mockResolvedValue({ id: "task-1", status: "in-review" });
  mocks.resolveTargetStatus.mockResolvedValue("done");
  mocks.updateExternalLink.mockResolvedValue(undefined);
  mocks.updateTaskStatus.mockResolvedValue({
    applied: true,
    before: { status: "in-review" },
    after: { id: "task-1", status: "done", projectId: "project-1", title: "t", userId: null },
  });
});

describe("handleGitlabMergeRequestClosed", () => {
  it("transitions the task to the merge status only when the MR was actually merged", async () => {
    await handleGitlabMergeRequestClosed(mrClosedPayload("merged"));

    expect(mocks.updateTaskStatus).toHaveBeenCalledWith("task-1", "done");
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({ newStatus: "done" }),
    );
  });

  it("does not transition the task on a plain close (not merged)", async () => {
    await handleGitlabMergeRequestClosed(mrClosedPayload("closed"));

    expect(mocks.updateTaskStatus).not.toHaveBeenCalled();
    expect(mocks.updateExternalLink).toHaveBeenCalledWith(
      "link-1",
      expect.objectContaining({
        metadata: expect.objectContaining({ state: "closed", merged: false }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kaneo/api test:unit -- merge-request-closed`
Expected: FAIL — files do not exist yet.

- [ ] **Step 3: Write the implementations**

```typescript
// apps/api/src/plugins/gitlab/webhooks/merge-request-opened.ts
import { publishEvent } from "../../../events";
import {
  createExternalLink,
  findExternalLink,
} from "../../github/services/link-manager";
import {
  findTaskByNumber,
  isTaskInFinalState,
  updateTaskStatus,
} from "../../github/services/task-service";
import type { GitlabConfig } from "../config";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { extractTaskNumberGitlab } from "../utils/branch-matcher";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type MROpenedPayload = {
  object_attributes: {
    iid: number;
    title: string;
    description: string | null;
    state: string;
    action: string;
    source_branch: string;
    url?: string;
  };
  project: {
    path_with_namespace: string;
    web_url: string;
  };
  user?: { username?: string } | null;
};

export async function handleGitlabMergeRequestOpened(
  payload: MROpenedPayload,
  integrationId?: string,
) {
  const { object_attributes: mr, project } = payload;

  const baseUrl = baseUrlFromProjectWebUrl(
    project.web_url,
    project.path_with_namespace,
  );
  if (!baseUrl) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  if (integrations.length === 0) {
    return;
  }

  for (const integration of integrations) {
    if (!integration.project) {
      continue;
    }

    let config: GitlabConfig;
    try {
      config = JSON.parse(integration.config) as GitlabConfig;
    } catch (error) {
      console.error("Invalid GitLab config for integration", {
        integrationId: integration.id,
        error,
      });
      continue;
    }
    const projectSlug = integration.project.slug;

    const taskNumber = extractTaskNumberGitlab(
      mr.source_branch,
      mr.title,
      mr.description ?? undefined,
      config,
      projectSlug,
    );

    if (!taskNumber) {
      continue;
    }

    const task = await findTaskByNumber(integration.projectId, taskNumber);

    if (!task) {
      continue;
    }

    const existingLink = await findExternalLink(
      integration.id,
      "pull_request",
      mr.iid.toString(),
    );

    if (existingLink) {
      continue;
    }

    const mrUrl = mr.url ?? `${project.web_url}/-/merge_requests/${mr.iid}`;

    await createExternalLink({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "pull_request",
      externalId: mr.iid.toString(),
      url: mrUrl,
      title: mr.title,
      metadata: {
        state: mr.state,
        merged: mr.state === "merged",
        branch: mr.source_branch,
        author: payload.user?.username,
      },
    });

    const targetStatus = await resolveTargetStatus(
      integration.projectId,
      "pr_opened",
      config.statusTransitions?.onMROpen || "in-review",
    );

    const isTaskFinal = await isTaskInFinalState(task);

    if (task.status !== targetStatus && !isTaskFinal) {
      const statusResult = await updateTaskStatus(task.id, targetStatus);
      if (
        statusResult.applied &&
        statusResult.before.status !== statusResult.after.status
      ) {
        await publishEvent("task.status_changed", {
          taskId: statusResult.after.id,
          projectId: statusResult.after.projectId,
          userId: null,
          oldStatus: statusResult.before.status,
          newStatus: statusResult.after.status,
          title: statusResult.after.title,
          assigneeId: statusResult.after.userId,
          type: "status_changed",
        });
      }
    }

    return;
  }
}
```

```typescript
// apps/api/src/plugins/gitlab/webhooks/merge-request-closed.ts
import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { updateExternalLink } from "../../github/services/link-manager";
import {
  findTaskById,
  updateTaskStatus,
} from "../../github/services/task-service";
import type { GitlabConfig } from "../config";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type MRClosedPayload = {
  object_attributes: {
    iid: number;
    title: string;
    state: string;
    action: string;
    source_branch: string;
  };
  project: {
    path_with_namespace: string;
    web_url: string;
  };
};

export async function handleGitlabMergeRequestClosed(
  payload: MRClosedPayload,
  integrationId?: string,
) {
  const { object_attributes: mr, project } = payload;

  const baseUrl = baseUrlFromProjectWebUrl(
    project.web_url,
    project.path_with_namespace,
  );
  if (!baseUrl) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  const merged = mr.state === "merged";

  for (const integration of integrations) {
    const config = JSON.parse(integration.config) as GitlabConfig;

    const externalLink = await db.query.externalLinkTable.findFirst({
      where: and(
        eq(externalLinkTable.integrationId, integration.id),
        eq(externalLinkTable.resourceType, "pull_request"),
        eq(externalLinkTable.externalId, mr.iid.toString()),
      ),
    });

    if (!externalLink) {
      continue;
    }

    const task = await findTaskById(externalLink.taskId);

    if (!task) {
      continue;
    }

    const existingMetadata = externalLink.metadata
      ? JSON.parse(externalLink.metadata)
      : {};

    await updateExternalLink(externalLink.id, {
      metadata: {
        ...existingMetadata,
        state: mr.state,
        merged,
      },
    });

    if (merged) {
      const allTaskMRs = await db.query.externalLinkTable.findMany({
        where: and(
          eq(externalLinkTable.taskId, task.id),
          eq(externalLinkTable.resourceType, "pull_request"),
        ),
      });

      const hasOpenMRs = allTaskMRs.some((mrLink) => {
        if (mrLink.id === externalLink.id) return false;
        const metadata = mrLink.metadata ? JSON.parse(mrLink.metadata) : {};
        return metadata.state === "opened";
      });

      if (!hasOpenMRs) {
        const targetStatus = await resolveTargetStatus(
          integration.projectId,
          "pr_merged",
          config.statusTransitions?.onMRMerge || "done",
        );
        const statusResult = await updateTaskStatus(task.id, targetStatus);
        if (
          statusResult.applied &&
          statusResult.before.status !== statusResult.after.status
        ) {
          await publishEvent("task.status_changed", {
            taskId: statusResult.after.id,
            projectId: statusResult.after.projectId,
            userId: null,
            oldStatus: statusResult.before.status,
            newStatus: statusResult.after.status,
            title: statusResult.after.title,
            assigneeId: statusResult.after.userId,
            type: "status_changed",
          });
        }
      }
    }

    return;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kaneo/api test:unit -- merge-request-closed`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/plugins/gitlab/webhooks/merge-request-opened.ts apps/api/src/plugins/gitlab/webhooks/merge-request-closed.ts tests/api/plugins/gitlab/webhooks/merge-request-closed.test.ts
git commit -m "feat(api): handle GitLab merge request webhook events"
```

---

### Task 11: Inbound webhook — Issue Hook (open)

**Files:**
- Create: `apps/api/src/plugins/gitlab/webhooks/issue-opened.ts`
- Test: `tests/api/plugins/gitlab/webhooks/issue-opened.test.ts`

**Interfaces:**
- Consumes: `claimTaskNumber` from `apps/api/src/task/controllers/claim-task-numbers.ts` (existing, unmodified); `createExternalLink`, `findExternalLink` (`plugins/github/services/link-manager`); `extractIssuePriority`, `extractIssueStatus` (`plugins/github/utils/extract-priority`); `formatTaskDescriptionFromIssue` (`plugins/github/utils/format`); `createGitlabClient` (Task 2); `addLabelsToIssueGitlab` (Task 5); `findAllIntegrationsByGitlabProject` (Task 4); `resolveTargetStatus` (Task 4); `baseUrlFromProjectWebUrl` (Task 4).
- Produces: `handleGitlabIssueOpened(payload, integrationId?): Promise<void>`.

GitLab's Issue Hook `labels` array uses `{id, title, color}` — the name field is called **`title`**, not `name`. This handler converts that to a plain `string[]` before calling `extractIssuePriority`/`extractIssueStatus`, since those helpers accept `string | {name?: string}` and a plain string array is the simplest shape that satisfies them. Comment-on-issue uses `client.createIssueNote` (GitLab's term for a comment), not `createIssueComment`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/plugins/gitlab/webhooks/issue-opened.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insertedValues: Array<Record<string, unknown>> = [];
  return {
    insertedValues,
    findAllIntegrationsByGitlabProject: vi.fn(),
    findExternalLink: vi.fn(),
    createExternalLink: vi.fn(),
    claimTaskNumber: vi.fn(),
    resolveTargetStatus: vi.fn(),
    publishEvent: vi.fn(),
    columnFindFirst: vi.fn(),
    projectFindFirst: vi.fn(),
    createGitlabClient: vi.fn(),
    addLabelsToIssueGitlab: vi.fn(),
    db: {
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          insertedValues.push(values);
          return { returning: async () => [{ id: "task-1", number: 7 }] };
        },
      }),
      query: {
        columnTable: {
          findFirst: (...a: unknown[]) => mocks.columnFindFirst(...a),
        },
        projectTable: {
          findFirst: (...a: unknown[]) => mocks.projectFindFirst(...a),
        },
      },
    },
  };
});

vi.mock("../../../../../apps/api/src/database", () => ({ default: mocks.db }));

vi.mock("../../../../../apps/api/src/events", () => ({
  publishEvent: (...a: unknown[]) => mocks.publishEvent(...a),
}));

vi.mock(
  "../../../../../apps/api/src/task/controllers/claim-task-numbers",
  () => ({
    claimTaskNumber: (...a: unknown[]) => mocks.claimTaskNumber(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    createExternalLink: (...a: unknown[]) => mocks.createExternalLink(...a),
    findExternalLink: (...a: unknown[]) => mocks.findExternalLink(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/services/integration-lookup",
  () => ({
    findAllIntegrationsByGitlabProject: (...a: unknown[]) =>
      mocks.findAllIntegrationsByGitlabProject(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/utils/resolve-column",
  () => ({
    resolveTargetStatus: (...a: unknown[]) => mocks.resolveTargetStatus(...a),
  }),
);

vi.mock("../../../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: (...a: unknown[]) => mocks.createGitlabClient(...a),
}));

vi.mock("../../../../../apps/api/src/plugins/gitlab/utils/labels", () => ({
  addLabelsToIssueGitlab: (...a: unknown[]) =>
    mocks.addLabelsToIssueGitlab(...a),
}));

const { handleGitlabIssueOpened } = await import(
  "../../../../../apps/api/src/plugins/gitlab/webhooks/issue-opened"
);

const integration = {
  id: "integration-1",
  projectId: "project-1",
  config: JSON.stringify({
    baseUrl: "https://gitlab.example.com",
    repositoryPath: "group/project",
    accessToken: "token",
  }),
};

function issueOpenedPayload(labels: Array<{ title: string }>) {
  return {
    object_attributes: {
      iid: 42,
      title: "Fix the login bug",
      description: "Steps to reproduce",
      url: "https://gitlab.example.com/group/project/-/issues/42",
      state: "opened",
      action: "open",
    },
    labels,
    project: {
      path_with_namespace: "group/project",
      web_url: "https://gitlab.example.com/group/project",
    },
    user: { username: "octocat" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insertedValues.length = 0;
  mocks.findAllIntegrationsByGitlabProject.mockResolvedValue([integration]);
  mocks.findExternalLink.mockResolvedValue(null);
  mocks.claimTaskNumber.mockResolvedValue(7);
  mocks.resolveTargetStatus.mockResolvedValue("to-do");
  mocks.columnFindFirst.mockResolvedValue(null);
  mocks.projectFindFirst.mockResolvedValue(null);
  mocks.createExternalLink.mockResolvedValue({ id: "link-1" });
  mocks.publishEvent.mockResolvedValue(undefined);
  mocks.createGitlabClient.mockReturnValue({
    createIssueNote: vi.fn().mockResolvedValue({}),
  });
});

describe("handleGitlabIssueOpened", () => {
  it("persists a valid default priority when the issue has no priority: label", async () => {
    await handleGitlabIssueOpened(issueOpenedPayload([{ title: "type:bug" }]));

    expect(mocks.insertedValues).toHaveLength(1);
    expect(mocks.insertedValues[0].priority).toBe("low");
  });

  it("persists the extracted priority label when present", async () => {
    await handleGitlabIssueOpened(
      issueOpenedPayload([{ title: "type:bug" }, { title: "priority:high" }]),
    );

    expect(mocks.insertedValues).toHaveLength(1);
    expect(mocks.insertedValues[0].priority).toBe("high");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kaneo/api test:unit -- plugins/gitlab/webhooks/issue-opened`
Expected: FAIL — `plugins/gitlab/webhooks/issue-opened.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/api/src/plugins/gitlab/webhooks/issue-opened.ts
import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { columnTable, projectTable, taskTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { claimTaskNumber } from "../../../task/controllers/claim-task-numbers";
import {
  createExternalLink,
  findExternalLink,
} from "../../github/services/link-manager";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../github/utils/extract-priority";
import { formatTaskDescriptionFromIssue } from "../../github/utils/format";
import type { GitlabConfig } from "../config";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { createGitlabClient } from "../utils/gitlab-api";
import { addLabelsToIssueGitlab } from "../utils/labels";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type IssueOpenedPayload = {
  object_attributes: {
    iid: number;
    title: string;
    description: string | null;
    url: string;
    state: string;
    action: string;
  };
  labels?: Array<{ title: string }>;
  project: {
    path_with_namespace: string;
    web_url: string;
  };
  user?: { username?: string } | null;
};

function labelNames(labels: Array<{ title: string }> | undefined): string[] {
  return (labels ?? []).map((l) => l.title);
}

export async function handleGitlabIssueOpened(
  payload: IssueOpenedPayload,
  integrationId?: string,
) {
  const { object_attributes: issue, project } = payload;

  const baseUrl = baseUrlFromProjectWebUrl(
    project.web_url,
    project.path_with_namespace,
  );
  if (!baseUrl) {
    return;
  }

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  if (integrations.length === 0) {
    return;
  }

  const names = labelNames(payload.labels);

  for (const integration of integrations) {
    let config: GitlabConfig;
    try {
      config = JSON.parse(integration.config) as GitlabConfig;
    } catch (error) {
      console.error("Invalid GitLab config for integration", {
        integrationId: integration.id,
        error,
      });
      continue;
    }
    const projectId = integration.projectId;

    const priority = extractIssuePriority(names);
    const status = extractIssueStatus(names);

    const existingLink = await findExternalLink(
      integration.id,
      "issue",
      issue.iid.toString(),
    );

    if (existingLink) {
      continue;
    }

    const nextTaskNumber = await claimTaskNumber(projectId);

    const resolvedStatus = await resolveTargetStatus(
      projectId,
      "issue_opened",
      status || "to-do",
    );

    const targetColumn = await db.query.columnTable.findFirst({
      where: and(
        eq(columnTable.projectId, projectId),
        eq(columnTable.slug, resolvedStatus),
      ),
    });

    const taskValues: typeof taskTable.$inferInsert = {
      projectId,
      userId: null,
      title: issue.title,
      description: formatTaskDescriptionFromIssue(issue.description),
      status: resolvedStatus,
      columnId: targetColumn?.id ?? null,
      priority: priority ?? "low",
      number: nextTaskNumber,
    };

    const [createdTask] = await db
      .insert(taskTable)
      .values(taskValues)
      .returning();

    if (!createdTask) {
      console.error("Failed to create task from GitLab issue");
      continue;
    }

    // Must run before task.created: the plugin's onTaskCreated uses link
    // existence to skip self-originated tasks, else it duplicates the issue.
    await createExternalLink({
      taskId: createdTask.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: issue.iid.toString(),
      url: issue.url,
      title: issue.title,
      metadata: {
        state: "opened",
        createdFrom: "gitlab",
        author: payload.user?.username,
      },
    });

    await publishEvent("task.created", {
      ...createdTask,
      taskId: createdTask.id,
      userId: createdTask.userId ?? "",
      type: "task",
      content: null,
      source: "gitlab",
      externalId: issue.iid.toString(),
      actor: payload.user?.username ?? "gitlab-webhook",
    });

    const project_ = await db.query.projectTable.findFirst({
      where: eq(projectTable.id, projectId),
    });

    if (!project_) {
      continue;
    }

    const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
    const taskUrl = `${clientUrl}/dashboard/workspace/${project_.workspaceId}/project/${projectId}/task/${createdTask.id}`;
    const taskIdentifier = `${project_.slug.toUpperCase()}-${createdTask.number}`;

    try {
      const client = createGitlabClient(config);

      const labelsToAdd: string[] = [];

      if (priority && !names.includes(`priority:${priority}`)) {
        labelsToAdd.push(`priority:${priority}`);
      }

      if (status && !names.includes(`status:${status}`)) {
        labelsToAdd.push(`status:${status}`);
      }

      if (labelsToAdd.length > 0) {
        await addLabelsToIssueGitlab(config, issue.iid, labelsToAdd);
      }

      if (config.commentTaskLinkOnGitlabIssue !== false) {
        await client.createIssueNote(
          config.repositoryPath,
          issue.iid,
          `[${taskIdentifier}](${taskUrl})`,
        );
      }
    } catch (error) {
      console.error("Failed to process GitLab issue:", error);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kaneo/api test:unit -- plugins/gitlab/webhooks/issue-opened`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/plugins/gitlab/webhooks/issue-opened.ts tests/api/plugins/gitlab/webhooks/issue-opened.test.ts
git commit -m "feat(api): handle GitLab issue-opened webhook event"
```

---

### Task 12: Inbound webhooks — Issue Hook (close, reopen)

**Files:**
- Create: `apps/api/src/plugins/gitlab/webhooks/issue-closed.ts`
- Create: `apps/api/src/plugins/gitlab/webhooks/issue-reopened.ts`
- Test: `tests/api/plugins/gitlab/webhooks/issue-closed.test.ts`

**Interfaces:**
- Consumes: `OUTBOUND_STATE_ECHO_WINDOW_MS`, `parseIssueUpdatedAtMs` (Task 4); `updateExternalLink` (`plugins/github/services/link-manager`); `updateTaskStatus` (`plugins/github/services/task-service`); `findAllIntegrationsByGitlabProject`, `resolveTargetStatus`, `baseUrlFromProjectWebUrl` (Task 4).
- Produces: `handleGitlabIssueClosed(payload, integrationId?): Promise<void>`, `handleGitlabIssueReopened(payload, integrationId?): Promise<void>`. Both guard against reacting to Kaneo's own outbound status sync via the echo window, matching Gitea's issue-closed/issue-reopened handlers exactly (only the payload shape differs — `object_attributes.iid`/`.updated_at` instead of a flat `issue.number`/`.updated_at`).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/plugins/gitlab/webhooks/issue-closed.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAllIntegrationsByGitlabProject: vi.fn(),
  updateTaskStatus: vi.fn(),
  updateExternalLink: vi.fn(),
  resolveTargetStatus: vi.fn(),
  publishEvent: vi.fn(),
  externalLinkFindFirst: vi.fn(),
  taskFindFirst: vi.fn(),
}));

vi.mock("../../../../../apps/api/src/database", () => ({
  default: {
    query: {
      externalLinkTable: {
        findFirst: (...a: unknown[]) => mocks.externalLinkFindFirst(...a),
      },
      taskTable: {
        findFirst: (...a: unknown[]) => mocks.taskFindFirst(...a),
      },
    },
  },
}));

vi.mock("../../../../../apps/api/src/events", () => ({
  publishEvent: (...a: unknown[]) => mocks.publishEvent(...a),
}));

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    updateExternalLink: (...a: unknown[]) => mocks.updateExternalLink(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/task-service",
  () => ({
    updateTaskStatus: (...a: unknown[]) => mocks.updateTaskStatus(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/services/integration-lookup",
  () => ({
    findAllIntegrationsByGitlabProject: (...a: unknown[]) =>
      mocks.findAllIntegrationsByGitlabProject(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/utils/resolve-column",
  () => ({
    resolveTargetStatus: (...a: unknown[]) => mocks.resolveTargetStatus(...a),
  }),
);

const { handleGitlabIssueClosed } = await import(
  "../../../../../apps/api/src/plugins/gitlab/webhooks/issue-closed"
);

const integration = { id: "integration-1", projectId: "project-1" };

function issueClosedPayload(updatedAt: string) {
  return {
    object_attributes: {
      iid: 42,
      title: "Fix bug",
      url: "https://gitlab.example.com/group/project/-/issues/42",
      state: "closed",
      action: "close",
      updated_at: updatedAt,
    },
    project: {
      path_with_namespace: "group/project",
      web_url: "https://gitlab.example.com/group/project",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findAllIntegrationsByGitlabProject.mockResolvedValue([integration]);
  mocks.externalLinkFindFirst.mockResolvedValue({
    id: "link-1",
    taskId: "task-1",
    metadata: null,
  });
  mocks.taskFindFirst.mockResolvedValue({ id: "task-1", projectId: "project-1" });
  mocks.resolveTargetStatus.mockResolvedValue("done");
  mocks.updateExternalLink.mockResolvedValue(undefined);
  mocks.updateTaskStatus.mockResolvedValue({
    applied: true,
    before: { status: "in-review" },
    after: { id: "task-1", status: "done", projectId: "project-1", title: "t", userId: null },
  });
});

describe("handleGitlabIssueClosed", () => {
  it("transitions the linked task to the closed target status", async () => {
    await handleGitlabIssueClosed(issueClosedPayload("2026-01-01T00:00:00Z"));

    expect(mocks.updateTaskStatus).toHaveBeenCalledWith("task-1", "done");
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({ newStatus: "done" }),
    );
  });

  it("skips the sync when it falls inside the outbound echo window", async () => {
    mocks.externalLinkFindFirst.mockResolvedValue({
      id: "link-1",
      taskId: "task-1",
      metadata: JSON.stringify({
        lastOutboundStateSyncAt: Date.parse("2026-01-01T00:00:00Z"),
      }),
    });

    await handleGitlabIssueClosed(issueClosedPayload("2026-01-01T00:00:01Z"));

    expect(mocks.updateTaskStatus).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kaneo/api test:unit -- plugins/gitlab/webhooks/issue-closed`
Expected: FAIL — files do not exist yet.

- [ ] **Step 3: Write the implementations**

```typescript
// apps/api/src/plugins/gitlab/webhooks/issue-closed.ts
import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable, taskTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { updateExternalLink } from "../../github/services/link-manager";
import { updateTaskStatus } from "../../github/services/task-service";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import {
  OUTBOUND_STATE_ECHO_WINDOW_MS,
  parseIssueUpdatedAtMs,
} from "../utils/outbound-echo";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type IssueClosedPayload = {
  object_attributes: {
    iid: number;
    title: string;
    url: string;
    state: string;
    action: string;
    updated_at?: string;
  };
  project: {
    path_with_namespace: string;
    web_url: string;
  };
};

export async function handleGitlabIssueClosed(
  payload: IssueClosedPayload,
  integrationId?: string,
) {
  const { object_attributes: issue, project } = payload;

  if (issue.action !== "close") {
    return;
  }

  const baseUrl = baseUrlFromProjectWebUrl(
    project.web_url,
    project.path_with_namespace,
  );
  if (!baseUrl) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  for (const integration of integrations) {
    const externalLink = await db.query.externalLinkTable.findFirst({
      where: and(
        eq(externalLinkTable.integrationId, integration.id),
        eq(externalLinkTable.resourceType, "issue"),
        eq(externalLinkTable.externalId, issue.iid.toString()),
      ),
    });

    if (!externalLink) {
      continue;
    }

    const task = await db.query.taskTable.findFirst({
      where: eq(taskTable.id, externalLink.taskId),
    });

    if (!task) {
      continue;
    }

    let existingMetadata: Record<string, unknown> = {};
    if (externalLink.metadata) {
      try {
        existingMetadata = JSON.parse(externalLink.metadata) as Record<
          string,
          unknown
        >;
      } catch (error) {
        console.warn("Failed to parse GitLab issue metadata for close sync", {
          externalLinkId: externalLink.id,
          metadata: externalLink.metadata,
          error,
        });
      }
    }

    const lastOutbound = existingMetadata.lastOutboundStateSyncAt;
    if (typeof lastOutbound === "number" && Number.isFinite(lastOutbound)) {
      const eventMs = parseIssueUpdatedAtMs(issue);
      if (
        eventMs !== null &&
        Math.abs(eventMs - lastOutbound) <= OUTBOUND_STATE_ECHO_WINDOW_MS
      ) {
        continue;
      }
    }

    const targetStatus = await resolveTargetStatus(
      task.projectId,
      "issue_closed",
      "done",
    );

    const statusResult = await updateTaskStatus(task.id, targetStatus);
    if (
      statusResult.applied &&
      statusResult.before.status !== statusResult.after.status
    ) {
      await publishEvent("task.status_changed", {
        taskId: statusResult.after.id,
        projectId: statusResult.after.projectId,
        userId: null,
        oldStatus: statusResult.before.status,
        newStatus: statusResult.after.status,
        title: statusResult.after.title,
        assigneeId: statusResult.after.userId,
        type: "status_changed",
      });
    }

    await updateExternalLink(externalLink.id, {
      metadata: {
        ...existingMetadata,
        state: "closed",
      },
    });
  }
}
```

```typescript
// apps/api/src/plugins/gitlab/webhooks/issue-reopened.ts
import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable, taskTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { updateExternalLink } from "../../github/services/link-manager";
import { updateTaskStatus } from "../../github/services/task-service";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import {
  OUTBOUND_STATE_ECHO_WINDOW_MS,
  parseIssueUpdatedAtMs,
} from "../utils/outbound-echo";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type IssueReopenedPayload = {
  object_attributes: {
    iid: number;
    title: string;
    url: string;
    state: string;
    action: string;
    updated_at?: string;
  };
  project: {
    path_with_namespace: string;
    web_url: string;
  };
};

export async function handleGitlabIssueReopened(
  payload: IssueReopenedPayload,
  integrationId?: string,
) {
  const { object_attributes: issue, project } = payload;

  if (issue.action !== "reopen") {
    return;
  }

  const baseUrl = baseUrlFromProjectWebUrl(
    project.web_url,
    project.path_with_namespace,
  );
  if (!baseUrl) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  for (const integration of integrations) {
    try {
      const externalLink = await db.query.externalLinkTable.findFirst({
        where: and(
          eq(externalLinkTable.integrationId, integration.id),
          eq(externalLinkTable.resourceType, "issue"),
          eq(externalLinkTable.externalId, issue.iid.toString()),
        ),
      });

      if (!externalLink) {
        continue;
      }

      const task = await db.query.taskTable.findFirst({
        where: eq(taskTable.id, externalLink.taskId),
      });

      if (!task) {
        continue;
      }

      let existingMetadata: Record<string, unknown> = {};
      if (externalLink.metadata) {
        try {
          existingMetadata = JSON.parse(externalLink.metadata) as Record<
            string,
            unknown
          >;
        } catch (error) {
          console.warn(
            "Failed to parse GitLab issue metadata for reopen sync",
            {
              externalLinkId: externalLink.id,
              metadata: externalLink.metadata,
              error,
            },
          );
        }
      }

      const lastOutbound = existingMetadata.lastOutboundStateSyncAt;
      if (typeof lastOutbound === "number" && Number.isFinite(lastOutbound)) {
        const eventMs = parseIssueUpdatedAtMs(issue);
        if (
          eventMs !== null &&
          Math.abs(eventMs - lastOutbound) <= OUTBOUND_STATE_ECHO_WINDOW_MS
        ) {
          continue;
        }
      }

      const targetStatus = await resolveTargetStatus(
        task.projectId,
        "issue_reopened",
        "to-do",
      );

      const statusResult = await updateTaskStatus(task.id, targetStatus);
      if (
        statusResult.applied &&
        statusResult.before.status !== statusResult.after.status
      ) {
        await publishEvent("task.status_changed", {
          taskId: statusResult.after.id,
          projectId: statusResult.after.projectId,
          userId: null,
          oldStatus: statusResult.before.status,
          newStatus: statusResult.after.status,
          title: statusResult.after.title,
          assigneeId: statusResult.after.userId,
          type: "status_changed",
        });
      }

      await updateExternalLink(externalLink.id, {
        metadata: {
          ...existingMetadata,
          state: "opened",
        },
      });
    } catch (error) {
      console.error("GitLab issue_reopened handler failed for integration", {
        integrationId: integration.id,
        issueIid: issue.iid,
        project: project.path_with_namespace,
        error,
      });
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kaneo/api test:unit -- plugins/gitlab/webhooks/issue-closed`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/plugins/gitlab/webhooks/issue-closed.ts apps/api/src/plugins/gitlab/webhooks/issue-reopened.ts tests/api/plugins/gitlab/webhooks/issue-closed.test.ts
git commit -m "feat(api): handle GitLab issue close/reopen webhook events"
```

---

### Task 13: Inbound webhooks — issue edit, label diff, and comment (Note Hook)

**Files:**
- Create: `apps/api/src/plugins/gitlab/webhooks/issue-edited.ts`
- Create: `apps/api/src/plugins/gitlab/webhooks/issue-labeled.ts`
- Create: `apps/api/src/plugins/gitlab/webhooks/issue-comment-created.ts`
- Test: `tests/api/plugins/gitlab/webhooks/issue-labeled.test.ts`

**Interfaces:**
- Consumes: `findExternalLink`, `updateExternalLink` (`plugins/github/services/link-manager`); `updateTaskStatus` (`plugins/github/services/task-service`); `extractIssuePriority`, `extractIssueStatus` (`plugins/github/utils/extract-priority`); `formatTaskDescriptionFromIssue` (`plugins/github/utils/format`); `isSystemLabelName` (Task 4); `findAllIntegrationsByGitlabProject`, `baseUrlFromProjectWebUrl` (Task 4).
- Produces: `handleGitlabIssueEdited(payload, integrationId?): Promise<void>`, `handleGitlabIssueLabeled(payload, integrationId?): Promise<void>`, `handleGitlabIssueCommentCreated(payload, integrationId?): Promise<void>`.

Two real deltas from Gitea:

1. **Label sync is a diff, not three separate events.** Gitea receives `labeled`/`unlabeled`/`label_updated` as distinct webhook actions. GitLab folds all label changes into one `Issue Hook` `action: "update"` event carrying `changes.labels.previous`/`.current` (arrays of `{id, title, color}` — note the field is **`title`**, not `name`). `handleGitlabIssueLabeled` computes the added/removed sets directly from that diff instead of branching on action type.
2. **Comments arrive as a separate webhook kind.** GitLab sends issue comments as a `Note Hook` (`object_kind: "note"`), not as part of the Issue Hook. `handleGitlabIssueCommentCreated` reads `object_attributes.note` (the comment body) and `object_attributes.noteable_type === "Issue"` to confirm it's an issue comment, with the related issue at `payload.issue.iid`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/plugins/gitlab/webhooks/issue-labeled.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAllIntegrationsByGitlabProject: vi.fn(),
  findExternalLink: vi.fn(),
  updateTaskStatus: vi.fn(),
  publishEvent: vi.fn(),
  taskFindFirst: vi.fn(),
  labelFindFirst: vi.fn(),
  labelFindMany: vi.fn(),
  insertedLabels: [] as Array<Record<string, unknown>>,
  deletedLabelIds: [] as string[],
}));

vi.mock("../../../../../apps/api/src/database", () => ({
  default: {
    query: {
      taskTable: { findFirst: (...a: unknown[]) => mocks.taskFindFirst(...a) },
      labelTable: {
        findFirst: (...a: unknown[]) => mocks.labelFindFirst(...a),
        findMany: (...a: unknown[]) => mocks.labelFindMany(...a),
      },
    },
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        mocks.insertedLabels.push(values);
        return { onConflictDoNothing: () => undefined };
      },
    }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    delete: () => ({
      where: (cond: { id?: string }) => {
        mocks.deletedLabelIds.push(String(cond));
        return Promise.resolve();
      },
    }),
  },
}));

vi.mock("../../../../../apps/api/src/events", () => ({
  publishEvent: (...a: unknown[]) => mocks.publishEvent(...a),
}));

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    findExternalLink: (...a: unknown[]) => mocks.findExternalLink(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/task-service",
  () => ({
    updateTaskStatus: (...a: unknown[]) => mocks.updateTaskStatus(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/services/integration-lookup",
  () => ({
    findAllIntegrationsByGitlabProject: (...a: unknown[]) =>
      mocks.findAllIntegrationsByGitlabProject(...a),
  }),
);

const { handleGitlabIssueLabeled } = await import(
  "../../../../../apps/api/src/plugins/gitlab/webhooks/issue-labeled"
);

const integration = { id: "integration-1", projectId: "project-1" };

function labeledPayload(
  previous: Array<{ title: string; color?: string }>,
  current: Array<{ title: string; color?: string }>,
) {
  return {
    object_attributes: { iid: 42, action: "update" },
    changes: { labels: { previous, current } },
    project: {
      path_with_namespace: "group/project",
      web_url: "https://gitlab.example.com/group/project",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insertedLabels.length = 0;
  mocks.deletedLabelIds.length = 0;
  mocks.findAllIntegrationsByGitlabProject.mockResolvedValue([integration]);
  mocks.findExternalLink.mockResolvedValue({ taskId: "task-1" });
  mocks.taskFindFirst.mockResolvedValue({
    id: "task-1",
    project: { workspaceId: "ws-1" },
  });
  mocks.labelFindFirst.mockResolvedValue(null);
  mocks.labelFindMany.mockResolvedValue([]);
});

describe("handleGitlabIssueLabeled", () => {
  it("inserts a newly added non-system label", async () => {
    await handleGitlabIssueLabeled(
      labeledPayload([], [{ title: "bug", color: "#FF0000" }]),
    );

    expect(mocks.insertedLabels).toHaveLength(1);
    expect(mocks.insertedLabels[0]).toMatchObject({
      name: "bug",
      color: "#FF0000",
      taskId: "task-1",
      workspaceId: "ws-1",
    });
  });

  it("does not treat a priority: label as a syncable label", async () => {
    await handleGitlabIssueLabeled(
      labeledPayload([], [{ title: "priority:high" }]),
    );

    expect(mocks.insertedLabels).toHaveLength(0);
  });

  it("ignores an unchanged label set", async () => {
    await handleGitlabIssueLabeled(
      labeledPayload(
        [{ title: "bug", color: "#FF0000" }],
        [{ title: "bug", color: "#FF0000" }],
      ),
    );

    expect(mocks.insertedLabels).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kaneo/api test:unit -- plugins/gitlab/webhooks/issue-labeled`
Expected: FAIL — files do not exist yet.

- [ ] **Step 3: Write the implementations**

```typescript
// apps/api/src/plugins/gitlab/webhooks/issue-edited.ts
import { eq } from "drizzle-orm";
import db from "../../../database";
import { taskTable } from "../../../database/schema";
import {
  findExternalLink,
  updateExternalLink,
} from "../../github/services/link-manager";
import { formatTaskDescriptionFromIssue } from "../../github/utils/format";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type IssueEditedPayload = {
  object_attributes: {
    iid: number;
    title: string;
    description: string | null;
    url: string;
    action: string;
  };
  changes?: {
    title?: { previous: string; current: string };
    description?: { previous: string; current: string };
  };
  project: {
    path_with_namespace: string;
    web_url: string;
  };
};

export async function handleGitlabIssueEdited(
  payload: IssueEditedPayload,
  integrationId?: string,
) {
  const { object_attributes: issue, project, changes } = payload;

  if (issue.action !== "update") {
    return;
  }
  if (!changes?.title && !changes?.description) {
    return;
  }

  const baseUrl = baseUrlFromProjectWebUrl(
    project.web_url,
    project.path_with_namespace,
  );
  if (!baseUrl) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  for (const integration of integrations) {
    const externalLink = await findExternalLink(
      integration.id,
      "issue",
      issue.iid.toString(),
    );

    if (!externalLink) {
      continue;
    }

    const task = await db.query.taskTable.findFirst({
      where: eq(taskTable.id, externalLink.taskId),
    });

    if (!task) {
      continue;
    }

    const metadata = externalLink.metadata
      ? JSON.parse(externalLink.metadata)
      : {};

    const updateData: Record<string, unknown> = {};
    const updatedMetadata = { ...metadata };

    if (!updatedMetadata.lastSync) {
      updatedMetadata.lastSync = {};
    }

    if (changes.title) {
      const lastTitleSync = metadata.lastSync?.title;

      let shouldUpdateTitle = true;

      if (lastTitleSync) {
        if (
          lastTitleSync.value === issue.title &&
          lastTitleSync.source === "kaneo"
        ) {
          shouldUpdateTitle = false;
        }

        const timeSinceLastSync =
          Date.now() - new Date(lastTitleSync.timestamp).getTime();
        if (timeSinceLastSync < 2000 && shouldUpdateTitle) {
          shouldUpdateTitle = false;
        }
      }

      if (shouldUpdateTitle) {
        updateData.title = issue.title;
        updatedMetadata.lastSync.title = {
          timestamp: new Date().toISOString(),
          source: "gitlab",
          value: issue.title,
        };
      }
    }

    if (changes.description) {
      const lastDescSync = metadata.lastSync?.description;
      const formattedDescription = formatTaskDescriptionFromIssue(
        issue.description,
      );

      let shouldUpdateDescription = true;

      if (lastDescSync) {
        if (
          lastDescSync.value === formattedDescription &&
          lastDescSync.source === "kaneo"
        ) {
          shouldUpdateDescription = false;
        }

        const timeSinceLastSync =
          Date.now() - new Date(lastDescSync.timestamp).getTime();
        if (timeSinceLastSync < 2000 && shouldUpdateDescription) {
          shouldUpdateDescription = false;
        }
      }

      if (shouldUpdateDescription) {
        updateData.description = formattedDescription;
        updatedMetadata.lastSync.description = {
          timestamp: new Date().toISOString(),
          source: "gitlab",
          value: formattedDescription,
        };
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(taskTable)
        .set(updateData)
        .where(eq(taskTable.id, task.id));

      await updateExternalLink(externalLink.id, {
        title: issue.title,
        metadata: updatedMetadata,
      });
    }

    return;
  }
}
```

```typescript
// apps/api/src/plugins/gitlab/webhooks/issue-labeled.ts
import { and, eq, inArray } from "drizzle-orm";
import db from "../../../database";
import { labelTable, taskTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { findExternalLink } from "../../github/services/link-manager";
import { updateTaskStatus } from "../../github/services/task-service";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../github/utils/extract-priority";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { isSystemLabelName } from "../utils/system-labels";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type GitlabLabelRef = { id: number; title: string; color?: string };

type IssueLabeledPayload = {
  object_attributes: {
    iid: number;
    action: string;
  };
  changes?: {
    labels?: { previous: GitlabLabelRef[]; current: GitlabLabelRef[] };
  };
  project: {
    path_with_namespace: string;
    web_url: string;
  };
};

export async function handleGitlabIssueLabeled(
  payload: IssueLabeledPayload,
  integrationId?: string,
) {
  const { object_attributes: issue, project, changes } = payload;

  if (issue.action !== "update" || !changes?.labels) {
    return;
  }

  const baseUrl = baseUrlFromProjectWebUrl(
    project.web_url,
    project.path_with_namespace,
  );
  if (!baseUrl) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  const previous = changes.labels.previous ?? [];
  const current = changes.labels.current ?? [];
  const previousNames = new Set(previous.map((l) => l.title));
  const currentNames = current.map((l) => l.title);
  const currentNameSet = new Set(currentNames);

  for (const integration of integrations) {
    try {
      const existingLink = await findExternalLink(
        integration.id,
        "issue",
        issue.iid.toString(),
      );

      if (!existingLink) {
        continue;
      }

      const priority = extractIssuePriority(currentNames);
      const status = extractIssueStatus(currentNames);

      if (priority) {
        await db
          .update(taskTable)
          .set({ priority })
          .where(eq(taskTable.id, existingLink.taskId));
      }

      if (status) {
        const statusResult = await updateTaskStatus(
          existingLink.taskId,
          status,
        );
        if (
          statusResult.applied &&
          statusResult.before.status !== statusResult.after.status
        ) {
          await publishEvent("task.status_changed", {
            taskId: statusResult.after.id,
            projectId: statusResult.after.projectId,
            userId: null,
            oldStatus: statusResult.before.status,
            newStatus: statusResult.after.status,
            title: statusResult.after.title,
            assigneeId: statusResult.after.userId,
            type: "status_changed",
          });
        }
      }

      const task = await db.query.taskTable.findFirst({
        where: eq(taskTable.id, existingLink.taskId),
        with: {
          project: true,
        },
      });
      if (!task?.project?.workspaceId) {
        continue;
      }

      const addedLabels = current.filter(
        (label) =>
          !isSystemLabelName(label.title) && !previousNames.has(label.title),
      );

      for (const label of addedLabels) {
        const existingLabel = await db.query.labelTable.findFirst({
          where: and(
            eq(labelTable.workspaceId, task.project.workspaceId),
            eq(labelTable.name, label.title),
            eq(labelTable.taskId, task.id),
          ),
        });

        if (!existingLabel) {
          await db
            .insert(labelTable)
            .values({
              name: label.title,
              color: label.color ?? "#6B7280",
              taskId: task.id,
              workspaceId: task.project.workspaceId,
            })
            .onConflictDoNothing({
              target: [labelTable.taskId, labelTable.name],
            });
        }
      }

      const removedNames = [...previousNames].filter(
        (name) => !currentNameSet.has(name) && !isSystemLabelName(name),
      );

      if (removedNames.length > 0) {
        const labelsToDelete = await db.query.labelTable.findMany({
          where: and(
            eq(labelTable.taskId, existingLink.taskId),
            inArray(labelTable.name, removedNames),
          ),
        });

        for (const label of labelsToDelete) {
          await db.delete(labelTable).where(eq(labelTable.id, label.id));
        }
      }
    } catch (error) {
      console.error("GitLab issue_labeled handler failed for integration", {
        integrationId: integration.id,
        issueIid: issue.iid,
        project: project.path_with_namespace,
        error,
      });
    }
  }
}
```

```typescript
// apps/api/src/plugins/gitlab/webhooks/issue-comment-created.ts
import db from "../../../database";
import { activityTable } from "../../../database/schema";
import { findExternalLink } from "../../github/services/link-manager";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type NoteCreatedPayload = {
  object_attributes: {
    id: number;
    note: string;
    noteable_type: string;
    url?: string;
    created_at: string;
  };
  issue?: { iid: number };
  user?: { username?: string; avatar_url?: string } | null;
  project: {
    path_with_namespace: string;
    web_url: string;
  };
};

export async function handleGitlabIssueCommentCreated(
  payload: NoteCreatedPayload,
  integrationId?: string,
) {
  const { object_attributes: note, issue, project } = payload;

  if (note.noteable_type !== "Issue" || !issue) {
    return;
  }

  const username = payload.user?.username ?? "";
  if (username.endsWith("-bot") || username.endsWith("[bot]")) {
    return;
  }

  const baseUrl = baseUrlFromProjectWebUrl(
    project.web_url,
    project.path_with_namespace,
  );
  if (!baseUrl) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  const noteUrl =
    note.url ?? `${project.web_url}/-/issues/${issue.iid}#note_${note.id}`;

  for (const integration of integrations) {
    const existingLink = await findExternalLink(
      integration.id,
      "issue",
      issue.iid.toString(),
    );

    if (!existingLink) {
      continue;
    }

    await db
      .insert(activityTable)
      .values({
        taskId: existingLink.taskId,
        type: "comment",
        content: note.note,
        externalUserName: username || "Unknown",
        externalUserAvatar: payload.user?.avatar_url ?? null,
        externalSource: "gitlab",
        externalUrl: noteUrl,
        eventData: {
          externalCommentId: note.id,
        },
      })
      .onConflictDoNothing({
        target: [
          activityTable.taskId,
          activityTable.externalSource,
          activityTable.externalUrl,
        ],
      });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kaneo/api test:unit -- plugins/gitlab/webhooks/issue-labeled`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/plugins/gitlab/webhooks/issue-edited.ts apps/api/src/plugins/gitlab/webhooks/issue-labeled.ts apps/api/src/plugins/gitlab/webhooks/issue-comment-created.ts tests/api/plugins/gitlab/webhooks/issue-labeled.test.ts
git commit -m "feat(api): handle GitLab issue edit, label diff, and comment webhook events"
```

---

### Task 14: Webhook dispatcher and route registration

**Files:**
- Create: `apps/api/src/plugins/gitlab/webhook-handler.ts`
- Modify: `apps/api/src/gitlab-integration/index.ts`
- Modify: `apps/api/src/index.ts`
- Test: `tests/api/plugins/gitlab/webhook-handler.test.ts`

**Interfaces:**
- Consumes: `verifyGitlabWebhookSecret` (Task 3); all nine `handleGitlab*` webhook functions from Tasks 9–13; `type GitlabConfig` (Task 1).
- Produces: `handleGitlabWebhookRequest(integrationId, rawBody, tokenHeader, eventHeader): Promise<{success: boolean; error?: string}>`. Wired into `handleGitlabWebhookRoute` (a Hono `Context` handler, exported from `gitlab-integration/index.ts`, mirroring `handleGiteaWebhookRoute`) and registered as `POST /gitlab-integration/webhook/:integrationId` in `apps/api/src/index.ts`.

Dispatch is keyed on the `X-Gitlab-Event` header (`"Push Hook"`, `"Merge Request Hook"`, `"Issue Hook"`, `"Note Hook"`), with a secondary branch on `object_attributes.action` for Merge Request and Issue hooks. An `Issue Hook` with `action: "update"` calls both `handleGitlabIssueEdited` and `handleGitlabIssueLabeled` — each already no-ops when its own relevant `changes` field is absent, so calling both unconditionally on every update is correct and matches how each function already guards itself.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/plugins/gitlab/webhook-handler.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  integrationFindFirst: vi.fn(),
  handlePush: vi.fn(),
  handleMROpened: vi.fn(),
  handleMRClosed: vi.fn(),
  handleIssueOpened: vi.fn(),
  handleIssueClosed: vi.fn(),
  handleIssueReopened: vi.fn(),
  handleIssueEdited: vi.fn(),
  handleIssueLabeled: vi.fn(),
  handleIssueComment: vi.fn(),
}));

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      integrationTable: {
        findFirst: (...a: unknown[]) => mocks.integrationFindFirst(...a),
      },
    },
  },
}));

vi.mock("../../../apps/api/src/plugins/gitlab/webhooks/push", () => ({
  handleGitlabPush: (...a: unknown[]) => mocks.handlePush(...a),
}));
vi.mock(
  "../../../apps/api/src/plugins/gitlab/webhooks/merge-request-opened",
  () => ({
    handleGitlabMergeRequestOpened: (...a: unknown[]) =>
      mocks.handleMROpened(...a),
  }),
);
vi.mock(
  "../../../apps/api/src/plugins/gitlab/webhooks/merge-request-closed",
  () => ({
    handleGitlabMergeRequestClosed: (...a: unknown[]) =>
      mocks.handleMRClosed(...a),
  }),
);
vi.mock("../../../apps/api/src/plugins/gitlab/webhooks/issue-opened", () => ({
  handleGitlabIssueOpened: (...a: unknown[]) => mocks.handleIssueOpened(...a),
}));
vi.mock("../../../apps/api/src/plugins/gitlab/webhooks/issue-closed", () => ({
  handleGitlabIssueClosed: (...a: unknown[]) => mocks.handleIssueClosed(...a),
}));
vi.mock(
  "../../../apps/api/src/plugins/gitlab/webhooks/issue-reopened",
  () => ({
    handleGitlabIssueReopened: (...a: unknown[]) =>
      mocks.handleIssueReopened(...a),
  }),
);
vi.mock("../../../apps/api/src/plugins/gitlab/webhooks/issue-edited", () => ({
  handleGitlabIssueEdited: (...a: unknown[]) => mocks.handleIssueEdited(...a),
}));
vi.mock(
  "../../../apps/api/src/plugins/gitlab/webhooks/issue-labeled",
  () => ({
    handleGitlabIssueLabeled: (...a: unknown[]) =>
      mocks.handleIssueLabeled(...a),
  }),
);
vi.mock(
  "../../../apps/api/src/plugins/gitlab/webhooks/issue-comment-created",
  () => ({
    handleGitlabIssueCommentCreated: (...a: unknown[]) =>
      mocks.handleIssueComment(...a),
  }),
);

const { handleGitlabWebhookRequest } = await import(
  "../../../apps/api/src/plugins/gitlab/webhook-handler"
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.integrationFindFirst.mockResolvedValue({
    id: "integration-1",
    type: "gitlab",
    config: JSON.stringify({ webhookSecret: "s3cr3t" }),
  });
});

describe("handleGitlabWebhookRequest", () => {
  it("rejects a request with a wrong token", async () => {
    const result = await handleGitlabWebhookRequest(
      "integration-1",
      JSON.stringify({ object_kind: "push" }),
      "wrong",
      "Push Hook",
    );
    expect(result.success).toBe(false);
    expect(mocks.handlePush).not.toHaveBeenCalled();
  });

  it("dispatches a Push Hook to handleGitlabPush", async () => {
    const body = JSON.stringify({
      object_kind: "push",
      ref: "refs/heads/kan-1",
      project: { path_with_namespace: "g/p", web_url: "https://gl/g/p" },
    });
    const result = await handleGitlabWebhookRequest(
      "integration-1",
      body,
      "s3cr3t",
      "Push Hook",
    );
    expect(result.success).toBe(true);
    expect(mocks.handlePush).toHaveBeenCalledTimes(1);
  });

  it("dispatches an Issue Hook update to both edited and labeled handlers", async () => {
    const body = JSON.stringify({
      object_kind: "issue",
      object_attributes: { iid: 1, action: "update" },
      project: { path_with_namespace: "g/p", web_url: "https://gl/g/p" },
    });
    const result = await handleGitlabWebhookRequest(
      "integration-1",
      body,
      "s3cr3t",
      "Issue Hook",
    );
    expect(result.success).toBe(true);
    expect(mocks.handleIssueEdited).toHaveBeenCalledTimes(1);
    expect(mocks.handleIssueLabeled).toHaveBeenCalledTimes(1);
  });

  it("dispatches a Note Hook to handleGitlabIssueCommentCreated", async () => {
    const body = JSON.stringify({
      object_kind: "note",
      object_attributes: { id: 1, note: "hi", noteable_type: "Issue" },
      issue: { iid: 1 },
      project: { path_with_namespace: "g/p", web_url: "https://gl/g/p" },
    });
    const result = await handleGitlabWebhookRequest(
      "integration-1",
      body,
      "s3cr3t",
      "Note Hook",
    );
    expect(result.success).toBe(true);
    expect(mocks.handleIssueComment).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kaneo/api test:unit -- webhook-handler`
Expected: FAIL — `plugins/gitlab/webhook-handler.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/api/src/plugins/gitlab/webhook-handler.ts
import { eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import type { GitlabConfig } from "./config";
import { verifyGitlabWebhookSecret } from "./utils/verify-token";
import { handleGitlabIssueClosed } from "./webhooks/issue-closed";
import { handleGitlabIssueCommentCreated } from "./webhooks/issue-comment-created";
import { handleGitlabIssueEdited } from "./webhooks/issue-edited";
import { handleGitlabIssueLabeled } from "./webhooks/issue-labeled";
import { handleGitlabIssueOpened } from "./webhooks/issue-opened";
import { handleGitlabIssueReopened } from "./webhooks/issue-reopened";
import { handleGitlabMergeRequestClosed } from "./webhooks/merge-request-closed";
import { handleGitlabMergeRequestOpened } from "./webhooks/merge-request-opened";
import { handleGitlabPush } from "./webhooks/push";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasProject(value: Record<string, unknown>) {
  return isRecord(value.project);
}

export async function handleGitlabWebhookRequest(
  integrationId: string,
  rawBody: string,
  tokenHeader: string | undefined,
  eventHeader: string | undefined,
): Promise<{ success: boolean; error?: string }> {
  const integration = await db.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
  });

  if (integration?.type !== "gitlab") {
    return { success: false, error: "GitLab integration not found" };
  }

  let config: GitlabConfig;
  try {
    config = JSON.parse(integration.config) as GitlabConfig;
  } catch {
    return { success: false, error: "Invalid integration config" };
  }

  const secret = config.webhookSecret;
  if (!secret) {
    return { success: false, error: "Webhook secret not configured" };
  }

  if (!verifyGitlabWebhookSecret(secret, tokenHeader)) {
    return { success: false, error: "Invalid webhook token" };
  }

  const event = eventHeader || undefined;

  if (!event) {
    return { success: false, error: "Missing event name" };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }

  if (!hasProject(payload)) {
    return { success: false, error: "Missing project in payload" };
  }

  try {
    await dispatchGitlabEvent(event, payload, integration.id);
    return { success: true };
  } catch (error) {
    console.error("[GitLab Webhook] Handler error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Webhook handler failed",
    };
  }
}

async function dispatchGitlabEvent(
  event: string,
  // biome-ignore lint/suspicious/noExplicitAny: each handler validates its own payload shape at runtime
  payload: any,
  integrationId: string,
) {
  console.log(`[GitLab Webhook] Event: ${event}`);

  switch (event) {
    case "Push Hook":
      await handleGitlabPush(payload, integrationId);
      return;

    case "Merge Request Hook": {
      const action = payload.object_attributes?.action as string | undefined;
      if (action === "open" || action === "reopen") {
        await handleGitlabMergeRequestOpened(payload, integrationId);
      } else if (action === "close" || action === "merge") {
        await handleGitlabMergeRequestClosed(payload, integrationId);
      }
      return;
    }

    case "Issue Hook": {
      const action = payload.object_attributes?.action as string | undefined;
      if (action === "open") {
        await handleGitlabIssueOpened(payload, integrationId);
      } else if (action === "reopen") {
        await handleGitlabIssueReopened(payload, integrationId);
      } else if (action === "close") {
        await handleGitlabIssueClosed(payload, integrationId);
      } else if (action === "update") {
        // Each handler no-ops on its own when its relevant `changes` field
        // is absent, so both are safe to call unconditionally here.
        await handleGitlabIssueEdited(payload, integrationId);
        await handleGitlabIssueLabeled(payload, integrationId);
      }
      return;
    }

    case "Note Hook": {
      const noteableType = payload.object_attributes?.noteable_type as
        | string
        | undefined;
      if (noteableType === "Issue") {
        await handleGitlabIssueCommentCreated(payload, integrationId);
      }
      return;
    }

    default:
      console.log(`[GitLab Webhook] Ignored event: ${event}`);
  }
}
```

- [ ] **Step 4: Add the route handler to `apps/api/src/gitlab-integration/index.ts`**

Add the import:

```typescript
import type { Context } from "hono";
import { handleGitlabWebhookRequest } from "../plugins/gitlab/webhook-handler";
```

Add at the bottom of the file, before `export default gitlabIntegration;`:

```typescript
export async function handleGitlabWebhookRoute(c: Context) {
  const integrationId = c.req.param("integrationId");
  if (!integrationId) {
    return c.json({ error: "Missing integration id" }, 400);
  }

  const arrayBuffer = await c.req.arrayBuffer();
  const body = Buffer.from(arrayBuffer).toString("utf8");

  const token = c.req.header("x-gitlab-token") || c.req.header("X-Gitlab-Token");
  const eventName =
    c.req.header("x-gitlab-event") || c.req.header("X-Gitlab-Event");

  const result = await handleGitlabWebhookRequest(
    integrationId,
    body,
    token,
    eventName,
  );

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ status: "success" });
}
```

- [ ] **Step 5: Register the webhook route in `apps/api/src/index.ts`**

Update the import from Task 7:

```typescript
import gitlabIntegration, {
  handleGitlabWebhookRoute,
} from "./gitlab-integration";
```

Add the route registration next to Gitea's:

```typescript
  api.post(
    "/gitlab-integration/webhook/:integrationId",
    handleGitlabWebhookRoute,
  );
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @kaneo/api test:unit -- webhook-handler`
Expected: PASS

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @kaneo/api exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/plugins/gitlab/webhook-handler.ts apps/api/src/gitlab-integration/index.ts apps/api/src/index.ts tests/api/plugins/gitlab/webhook-handler.test.ts
git commit -m "feat(api): dispatch and route GitLab webhook events"
```

---

### Task 15: Outbound task events + plugin registration

**Files:**
- Create: `apps/api/src/plugins/gitlab/events/task-created.ts`
- Create: `apps/api/src/plugins/gitlab/events/task-status-changed.ts`
- Create: `apps/api/src/plugins/gitlab/events/task-priority-changed.ts`
- Create: `apps/api/src/plugins/gitlab/events/task-title-changed.ts`
- Create: `apps/api/src/plugins/gitlab/events/task-description-changed.ts`
- Create: `apps/api/src/plugins/gitlab/events/task-comment-created.ts`
- Create: `apps/api/src/plugins/gitlab/index.ts`
- Modify: `apps/api/src/plugins/index.ts`
- Test: `tests/api/plugins/gitlab/events/task-status-changed.test.ts`

**Interfaces:**
- Consumes: `findExternalLinkByTaskAndType`, `findExternalLinksByTask`, `updateExternalLink`, `createExternalLink` (`plugins/github/services/link-manager`); `formatIssueBody`, `formatIssueTitle`, `getLabelsForIssue` (`plugins/github/utils/format`); `type PluginContext`, `type TaskCreatedEvent`, etc. from `plugins/types.ts` (existing, unmodified); `createGitlabClient` (Task 2); `addLabelsToIssueGitlab`, `removeLabelGitlab` (Task 5); `validateGitlabConfig` (Task 1); `type IntegrationPlugin` (`plugins/types.ts`).
- Produces: `handleTaskCreated`, `handleTaskStatusChanged`, `handleTaskPriorityChanged`, `handleTaskTitleChanged`, `handleTaskDescriptionChanged`, `handleTaskCommentCreated` (each `TaskEventHandler<...>`); `gitlabPlugin: IntegrationPlugin` registered via `registerPlugin(gitlabPlugin)` in `plugins/index.ts`.

The one real GitLab API delta across all six: closing/reopening an issue is **not** `{ state: "closed" }` on `updateIssue` (that field is read-only in GitLab's API) — it's `{ state_event: "close" | "reopen" }`. `handleTaskStatusChanged` is the only handler that touches issue state, so it's the only one affected.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/plugins/gitlab/events/task-status-changed.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findExternalLinksByTask: vi.fn(),
  updateExternalLink: vi.fn(),
  updateIssue: vi.fn(),
  addLabelsToIssueGitlab: vi.fn(),
  removeLabelGitlab: vi.fn(),
}));

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    findExternalLinksByTask: (...a: unknown[]) =>
      mocks.findExternalLinksByTask(...a),
    updateExternalLink: (...a: unknown[]) => mocks.updateExternalLink(...a),
  }),
);

vi.mock("../../../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({
    updateIssue: (...a: unknown[]) => mocks.updateIssue(...a),
  }),
}));

vi.mock("../../../../../apps/api/src/plugins/gitlab/utils/labels", () => ({
  addLabelsToIssueGitlab: (...a: unknown[]) =>
    mocks.addLabelsToIssueGitlab(...a),
  removeLabelGitlab: (...a: unknown[]) => mocks.removeLabelGitlab(...a),
}));

const { handleTaskStatusChanged } = await import(
  "../../../../../apps/api/src/plugins/gitlab/events/task-status-changed"
);

const context = {
  integrationId: "integration-1",
  projectId: "project-1",
  config: {
    baseUrl: "https://gitlab.example.com",
    accessToken: "token",
    repositoryPath: "group/project",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findExternalLinksByTask.mockResolvedValue([
    {
      id: "link-1",
      integrationId: "integration-1",
      resourceType: "issue",
      externalId: "5",
      metadata: null,
    },
  ]);
});

describe("handleTaskStatusChanged", () => {
  it("closes the GitLab issue via state_event when the task reaches done", async () => {
    await handleTaskStatusChanged(
      { taskId: "task-1", projectId: "project-1", userId: null, oldStatus: "in-review", newStatus: "done", title: "t" },
      context,
    );

    expect(mocks.updateIssue).toHaveBeenCalledWith("group/project", 5, {
      state_event: "close",
    });
  });

  it("reopens the GitLab issue via state_event when the task leaves done", async () => {
    await handleTaskStatusChanged(
      { taskId: "task-1", projectId: "project-1", userId: null, oldStatus: "done", newStatus: "to-do", title: "t" },
      context,
    );

    expect(mocks.updateIssue).toHaveBeenCalledWith("group/project", 5, {
      state_event: "reopen",
    });
  });

  it("does not touch issue state for a non-done transition", async () => {
    await handleTaskStatusChanged(
      { taskId: "task-1", projectId: "project-1", userId: null, oldStatus: "to-do", newStatus: "in-progress", title: "t" },
      context,
    );

    expect(mocks.updateIssue).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kaneo/api test:unit -- events/task-status-changed`
Expected: FAIL — `plugins/gitlab/events/task-status-changed.ts` does not exist yet.

- [ ] **Step 3: Write the implementations**

```typescript
// apps/api/src/plugins/gitlab/events/task-created.ts
import {
  createExternalLink,
  findExternalLinkByTaskAndType,
} from "../../github/services/link-manager";
import {
  formatIssueBody,
  formatIssueTitle,
  getLabelsForIssue,
} from "../../github/utils/format";
import type { PluginContext, TaskCreatedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import { addLabelsToIssueGitlab } from "../utils/labels";

export async function handleTaskCreated(
  event: TaskCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GitlabConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  const existingLink = await findExternalLinkByTaskAndType(
    event.taskId,
    context.integrationId,
    "issue",
  );

  if (existingLink) {
    return;
  }

  try {
    const client = createGitlabClient(config);
    const createdIssue = await client.createIssue(config.repositoryPath, {
      title: formatIssueTitle(event.title),
      description: formatIssueBody(event.description, event.taskId),
    });

    await createExternalLink({
      taskId: event.taskId,
      integrationId: context.integrationId,
      resourceType: "issue",
      externalId: createdIssue.iid.toString(),
      url: createdIssue.web_url,
      title: createdIssue.title,
      metadata: {
        state: createdIssue.state,
        createdFrom: "kaneo",
        lastOutboundStateSyncAt: Date.now(),
      },
    });

    const labels = getLabelsForIssue(event.priority, event.status);
    await addLabelsToIssueGitlab(config, createdIssue.iid, labels);
  } catch (error) {
    console.error("Failed to create GitLab issue:", error);
  }
}
```

```typescript
// apps/api/src/plugins/gitlab/events/task-status-changed.ts
import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import type { PluginContext, TaskStatusChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import { addLabelsToIssueGitlab, removeLabelGitlab } from "../utils/labels";

export async function handleTaskStatusChanged(
  event: TaskStatusChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GitlabConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  try {
    const links = await findExternalLinksByTask(event.taskId);
    const issueLink = links.find(
      (link) =>
        link.integrationId === context.integrationId &&
        link.resourceType === "issue",
    );

    if (!issueLink) {
      return;
    }

    const client = createGitlabClient(config);
    const issueIid = Number.parseInt(issueLink.externalId, 10);

    await removeLabelGitlab(config, issueIid, `status:${event.oldStatus}`);

    await addLabelsToIssueGitlab(config, issueIid, [
      `status:${event.newStatus}`,
    ]);

    // GitLab's issue `state` is read-only on update — closing/reopening
    // goes through the state_event action field instead.
    if (event.newStatus === "done") {
      await client.updateIssue(config.repositoryPath, issueIid, {
        state_event: "close",
      });

      await updateExternalLink(issueLink.id, {
        metadata: {
          ...(issueLink.metadata ? JSON.parse(issueLink.metadata) : {}),
          state: "closed",
          lastOutboundStateSyncAt: Date.now(),
        },
      });
    } else if (event.oldStatus === "done" && event.newStatus !== "done") {
      await client.updateIssue(config.repositoryPath, issueIid, {
        state_event: "reopen",
      });

      await updateExternalLink(issueLink.id, {
        metadata: {
          ...(issueLink.metadata ? JSON.parse(issueLink.metadata) : {}),
          state: "opened",
          lastOutboundStateSyncAt: Date.now(),
        },
      });
    }
  } catch (error) {
    console.error("Failed to update GitLab issue status:", error);
  }
}
```

```typescript
// apps/api/src/plugins/gitlab/events/task-priority-changed.ts
import { findExternalLinksByTask } from "../../github/services/link-manager";
import type { PluginContext, TaskPriorityChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { addLabelsToIssueGitlab, removeLabelGitlab } from "../utils/labels";

export async function handleTaskPriorityChanged(
  event: TaskPriorityChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GitlabConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  try {
    const links = await findExternalLinksByTask(event.taskId);
    const issueLink = links.find(
      (link) =>
        link.integrationId === context.integrationId &&
        link.resourceType === "issue",
    );

    if (!issueLink) {
      return;
    }

    const issueIid = Number.parseInt(issueLink.externalId, 10);

    if (event.oldPriority && event.oldPriority !== "no-priority") {
      await removeLabelGitlab(
        config,
        issueIid,
        `priority:${event.oldPriority}`,
      );
    }

    if (event.newPriority && event.newPriority !== "no-priority") {
      await addLabelsToIssueGitlab(config, issueIid, [
        `priority:${event.newPriority}`,
      ]);
    }
  } catch (error) {
    console.error("Failed to update GitLab issue priority:", error);
  }
}
```

```typescript
// apps/api/src/plugins/gitlab/events/task-title-changed.ts
import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import type { PluginContext, TaskTitleChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";

type LinkSyncState = {
  timestamp: string;
  source: string;
  value: string;
};

type LinkMetadata = {
  lastSync?: {
    title?: LinkSyncState;
  };
  [key: string]: unknown;
};

export async function handleTaskTitleChanged(
  event: TaskTitleChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GitlabConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  try {
    const links = await findExternalLinksByTask(event.taskId);
    const issueLink = links.find(
      (link) =>
        link.integrationId === context.integrationId &&
        link.resourceType === "issue",
    );

    if (!issueLink) {
      return;
    }

    let metadata: LinkMetadata = {};
    if (issueLink.metadata) {
      try {
        metadata = JSON.parse(issueLink.metadata) as LinkMetadata;
      } catch (error) {
        console.warn(
          "Failed to parse GitLab issue link metadata for title sync",
          {
            issueLinkId: issueLink.id,
            taskId: issueLink.taskId,
            metadata: issueLink.metadata,
            error,
          },
        );
      }
    }

    const lastTitleSync = metadata.lastSync?.title;
    if (lastTitleSync) {
      if (
        lastTitleSync.value === event.newTitle &&
        lastTitleSync.source === "gitlab"
      ) {
        return;
      }

      const timeSinceLastSync =
        Date.now() - new Date(lastTitleSync.timestamp).getTime();
      if (lastTitleSync.source === "gitlab" && timeSinceLastSync < 2000) {
        return;
      }
    }

    const client = createGitlabClient(config);
    const issueIid = Number.parseInt(issueLink.externalId, 10);
    if (Number.isNaN(issueIid)) {
      console.warn("Skipping GitLab title sync for invalid issue iid", {
        issueLinkId: issueLink.id,
        externalId: issueLink.externalId,
        taskId: issueLink.taskId,
      });
      return;
    }

    await client.updateIssue(config.repositoryPath, issueIid, {
      title: event.newTitle,
    });

    await updateExternalLink(issueLink.id, {
      title: event.newTitle,
      metadata: {
        ...metadata,
        lastSync: {
          ...(metadata.lastSync ?? {}),
          title: {
            timestamp: new Date().toISOString(),
            source: "kaneo",
            value: event.newTitle,
          },
        },
      },
    });
  } catch (error) {
    console.error("Failed to update GitLab issue title:", error);
  }
}
```

```typescript
// apps/api/src/plugins/gitlab/events/task-description-changed.ts
import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import { formatIssueBody } from "../../github/utils/format";
import type { PluginContext, TaskDescriptionChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";

type LinkSyncState = {
  timestamp: string;
  source: string;
  value: string;
};

type LinkMetadata = {
  lastSync?: {
    description?: LinkSyncState;
  };
  [key: string]: unknown;
};

export async function handleTaskDescriptionChanged(
  event: TaskDescriptionChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GitlabConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  try {
    const links = await findExternalLinksByTask(event.taskId);
    const issueLink = links.find(
      (link) =>
        link.integrationId === context.integrationId &&
        link.resourceType === "issue",
    );

    if (!issueLink) {
      return;
    }

    let metadata: LinkMetadata = {};
    if (issueLink.metadata) {
      try {
        metadata = JSON.parse(issueLink.metadata) as LinkMetadata;
      } catch (error) {
        console.warn(
          "Failed to parse GitLab issue link metadata for description sync",
          {
            issueLinkId: issueLink.id,
            taskId: issueLink.taskId,
            metadata: issueLink.metadata,
            error,
          },
        );
      }
    }

    const lastDescSync = metadata.lastSync?.description;
    const newDescNormalized = event.newDescription || "";

    if (lastDescSync) {
      if (
        lastDescSync.value === newDescNormalized &&
        lastDescSync.source === "gitlab"
      ) {
        return;
      }

      const timeSinceLastSync =
        Date.now() - new Date(lastDescSync.timestamp).getTime();
      if (
        timeSinceLastSync < 2000 &&
        lastDescSync.source === "gitlab" &&
        newDescNormalized === lastDescSync.value
      ) {
        return;
      }
    }

    const client = createGitlabClient(config);
    const issueIid = Number.parseInt(issueLink.externalId, 10);
    if (Number.isNaN(issueIid)) {
      console.warn("Skipping GitLab description sync for invalid issue iid", {
        issueLinkId: issueLink.id,
        externalId: issueLink.externalId,
        taskId: issueLink.taskId,
      });
      return;
    }

    const formattedBody = formatIssueBody(event.newDescription, event.taskId);

    await client.updateIssue(config.repositoryPath, issueIid, {
      description: formattedBody,
    });

    await updateExternalLink(issueLink.id, {
      metadata: {
        ...metadata,
        lastSync: {
          ...(metadata.lastSync ?? {}),
          description: {
            timestamp: new Date().toISOString(),
            source: "kaneo",
            value: newDescNormalized,
          },
        },
      },
    });
  } catch (error) {
    console.error("Failed to update GitLab issue description:", error);
  }
}
```

```typescript
// apps/api/src/plugins/gitlab/events/task-comment-created.ts
import { findExternalLinkByTaskAndType } from "../../github/services/link-manager";
import type { PluginContext, TaskCommentCreatedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";

export async function handleTaskCommentCreated(
  event: TaskCommentCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GitlabConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  const existingLink = await findExternalLinkByTaskAndType(
    event.taskId,
    context.integrationId,
    "issue",
  );

  if (!existingLink) {
    return;
  }

  try {
    const client = createGitlabClient(config);
    if (!/^\d+$/.test(existingLink.externalId)) {
      console.error(
        "Skipping GitLab comment sync for invalid external issue id",
        {
          taskId: event.taskId,
          externalId: existingLink.externalId,
        },
      );
      return;
    }

    const issueIid = Number(existingLink.externalId);

    if (!Number.isFinite(issueIid) || issueIid < 1) {
      console.error("Skipping GitLab comment sync for invalid issue iid", {
        taskId: event.taskId,
        externalId: existingLink.externalId,
        issueIid,
      });
      return;
    }

    await client.createIssueNote(
      config.repositoryPath,
      issueIid,
      event.comment,
    );
  } catch (error) {
    console.error("Failed to create GitLab comment:", error);
  }
}
```

```typescript
// apps/api/src/plugins/gitlab/index.ts
import type { IntegrationPlugin } from "../types";
import { validateGitlabConfig } from "./config";
import { handleTaskCommentCreated } from "./events/task-comment-created";
import { handleTaskCreated } from "./events/task-created";
import { handleTaskDescriptionChanged } from "./events/task-description-changed";
import { handleTaskPriorityChanged } from "./events/task-priority-changed";
import { handleTaskStatusChanged } from "./events/task-status-changed";
import { handleTaskTitleChanged } from "./events/task-title-changed";

export const gitlabPlugin: IntegrationPlugin = {
  type: "gitlab",
  name: "GitLab",
  onTaskCreated: handleTaskCreated,
  onTaskStatusChanged: handleTaskStatusChanged,
  onTaskPriorityChanged: handleTaskPriorityChanged,
  onTaskTitleChanged: handleTaskTitleChanged,
  onTaskDescriptionChanged: handleTaskDescriptionChanged,
  onTaskCommentCreated: handleTaskCommentCreated,
  validateConfig: validateGitlabConfig,
};
```

- [ ] **Step 4: Register the plugin in `apps/api/src/plugins/index.ts`**

```typescript
import { gitlabPlugin } from "./gitlab";
```

```typescript
  registerPlugin(gitlabPlugin);
```

(Add both lines next to the existing `giteaPlugin` import/registration.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @kaneo/api test:unit -- events/task-status-changed`
Expected: PASS

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @kaneo/api exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/plugins/gitlab/events apps/api/src/plugins/gitlab/index.ts apps/api/src/plugins/index.ts tests/api/plugins/gitlab/events/task-status-changed.test.ts
git commit -m "feat(api): sync Kaneo task changes to GitLab and register the plugin"
```

---

**Backend complete after Task 15.** The remaining tasks build the web UI on top of it.

### Task 16: Web fetchers and query/mutation hooks

**Files:**
- Create: `apps/web/src/fetchers/gitlab-integration/create-gitlab-integration.ts`
- Create: `apps/web/src/fetchers/gitlab-integration/get-gitlab-integration.ts`
- Create: `apps/web/src/fetchers/gitlab-integration/update-gitlab-integration.ts`
- Create: `apps/web/src/fetchers/gitlab-integration/delete-gitlab-integration.ts`
- Create: `apps/web/src/fetchers/gitlab-integration/verify-gitlab-access.ts`
- Create: `apps/web/src/fetchers/gitlab-integration/list-gitlab-repositories.ts`
- Create: `apps/web/src/fetchers/gitlab-integration/import-gitlab-issues.ts`
- Create: `apps/web/src/hooks/mutations/gitlab-integration/use-create-gitlab-integration.ts`
- Create: `apps/web/src/hooks/mutations/gitlab-integration/use-update-gitlab-integration.ts`
- Create: `apps/web/src/hooks/mutations/gitlab-integration/use-import-gitlab-issues.ts`
- Create: `apps/web/src/hooks/queries/gitlab-integration/use-get-gitlab-integration.ts`

**Interfaces:**
- Consumes: `client` from `@kaneo/libs` (existing typed Hono client — its `gitlab-integration` namespace becomes available automatically once Task 7/8/14 register the router, since the client is generated from `AppType`).
- Produces: default-exported fetcher functions (`createGitlabIntegration`, `getGitlabIntegration`, `updateGitlabIntegration`, `deleteGitlabIntegration`, `listGitlabRepositories`, `importGitlabIssues`), named export `verifyGitlabAccess`; `useCreateGitlabIntegration`, `useDeleteGitlabIntegration`, `useVerifyGitlabAccess`, `useUpdateGitlabIntegration`, `useImportGitlabIssues` (named exports), `useGetGitlabIntegration` (default export). Task 17's components import all of these by exactly these names.

This is a mechanical, 1:1 port of the Gitea fetchers/hooks — same request/response shapes, same TanStack Query cache-key convention (`["gitlab-integration", projectId]`), only the router segment name and field names (`repositoryPath` instead of `repositoryOwner`/`repositoryName`) change. There is no independently meaningful behavior to unit-test here beyond what TypeScript already checks against the generated client types, so this task verifies itself via typecheck rather than a new test file — consistent with how thin fetcher/hook pairs are treated elsewhere in this codebase (no dedicated fetcher tests exist for Gitea's either).

- [ ] **Step 1: Write the fetchers**

```typescript
// apps/web/src/fetchers/gitlab-integration/create-gitlab-integration.ts
import { client } from "@kaneo/libs";

export type CreateGitlabIntegrationRequest = {
  baseUrl: string;
  accessToken?: string;
  repositoryPath: string;
};

async function createGitlabIntegration(
  projectId: string,
  data: CreateGitlabIntegrationRequest,
) {
  const response = await client["gitlab-integration"].project[
    ":projectId"
  ].$post({
    param: { projectId },
    json: data,
  });

  if (!response.ok) {
    const error = await response
      .clone()
      .json()
      .catch(async () => ({
        message: (await response.text()) || "Request failed",
      }));
    throw new Error(
      typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "Request failed",
    );
  }

  return response.json();
}

export default createGitlabIntegration;
```

```typescript
// apps/web/src/fetchers/gitlab-integration/get-gitlab-integration.ts
import { client } from "@kaneo/libs";

async function getGitlabIntegration(projectId: string) {
  const response = await client["gitlab-integration"].project[
    ":projectId"
  ].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}

export default getGitlabIntegration;
```

```typescript
// apps/web/src/fetchers/gitlab-integration/update-gitlab-integration.ts
import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";

export type UpdateGitlabIntegrationRequest = InferRequestType<
  (typeof client)["gitlab-integration"]["project"][":projectId"]["$patch"]
>["json"];

async function updateGitlabIntegration(
  projectId: string,
  json: UpdateGitlabIntegrationRequest,
) {
  const response = await client["gitlab-integration"].project[
    ":projectId"
  ].$patch({
    param: { projectId },
    json,
  });

  if (!response.ok) {
    const error = await response
      .clone()
      .json()
      .catch(async () => ({
        message: (await response.text()) || "Request failed",
      }));
    throw new Error(
      typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "Request failed",
    );
  }

  return response.json();
}

export default updateGitlabIntegration;
```

```typescript
// apps/web/src/fetchers/gitlab-integration/delete-gitlab-integration.ts
import { client } from "@kaneo/libs";

async function deleteGitlabIntegration(projectId: string) {
  const response = await client["gitlab-integration"].project[
    ":projectId"
  ].$delete({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteGitlabIntegration;
```

```typescript
// apps/web/src/fetchers/gitlab-integration/verify-gitlab-access.ts
import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";

export type VerifyGitlabAccessRequest = InferRequestType<
  (typeof client)["gitlab-integration"]["verify"]["$post"]
>["json"];

export type VerifyGitlabAccessResponse = InferResponseType<
  (typeof client)["gitlab-integration"]["verify"]["$post"],
  200
>;

async function verifyGitlabAccess(
  data: VerifyGitlabAccessRequest,
): Promise<VerifyGitlabAccessResponse> {
  const response = await client["gitlab-integration"].verify.$post({
    json: data,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Request failed" }));
    throw new Error(
      typeof error === "object" && error && "message" in error
        ? String((error as { message: string }).message)
        : "Request failed",
    );
  }

  return response.json();
}

export default verifyGitlabAccess;
```

```typescript
// apps/web/src/fetchers/gitlab-integration/list-gitlab-repositories.ts
import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";

export type ListGitlabRepositoriesRequest = InferRequestType<
  (typeof client)["gitlab-integration"]["repositories"]["$post"]
>["json"];

export type ListGitlabRepositoriesResponse = InferResponseType<
  (typeof client)["gitlab-integration"]["repositories"]["$post"],
  200
>;

async function listGitlabRepositories(
  data: ListGitlabRepositoriesRequest,
): Promise<ListGitlabRepositoriesResponse> {
  const response = await client["gitlab-integration"].repositories.$post({
    json: data,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || "Request failed");
  }

  return response.json();
}

export default listGitlabRepositories;
```

```typescript
// apps/web/src/fetchers/gitlab-integration/import-gitlab-issues.ts
import { client } from "@kaneo/libs";

async function importGitlabIssues(projectId: string) {
  const response = await client["gitlab-integration"]["import-issues"].$post({
    json: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default importGitlabIssues;
```

- [ ] **Step 2: Write the hooks**

```typescript
// apps/web/src/hooks/mutations/gitlab-integration/use-create-gitlab-integration.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import createGitlabIntegration, {
  type CreateGitlabIntegrationRequest,
} from "@/fetchers/gitlab-integration/create-gitlab-integration";
import deleteGitlabIntegration from "@/fetchers/gitlab-integration/delete-gitlab-integration";
import verifyGitlabAccess, {
  type VerifyGitlabAccessRequest,
} from "@/fetchers/gitlab-integration/verify-gitlab-access";

export function useCreateGitlabIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateGitlabIntegrationRequest;
    }) => createGitlabIntegration(projectId, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["gitlab-integration", projectId],
      });
    },
  });
}

export function useDeleteGitlabIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteGitlabIntegration(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({
        queryKey: ["gitlab-integration", projectId],
      });
    },
  });
}

export function useVerifyGitlabAccess() {
  return useMutation({
    mutationFn: (data: VerifyGitlabAccessRequest) => verifyGitlabAccess(data),
  });
}
```

```typescript
// apps/web/src/hooks/mutations/gitlab-integration/use-update-gitlab-integration.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateGitlabIntegration, {
  type UpdateGitlabIntegrationRequest,
} from "@/fetchers/gitlab-integration/update-gitlab-integration";

export function useUpdateGitlabIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      json,
    }: {
      projectId: string;
      json: UpdateGitlabIntegrationRequest;
    }) => updateGitlabIntegration(projectId, json),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["gitlab-integration", projectId],
      });
    },
  });
}
```

```typescript
// apps/web/src/hooks/mutations/gitlab-integration/use-import-gitlab-issues.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import importGitlabIssues from "@/fetchers/gitlab-integration/import-gitlab-issues";

export default function useImportGitlabIssues() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => importGitlabIssues(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}
```

```typescript
// apps/web/src/hooks/queries/gitlab-integration/use-get-gitlab-integration.ts
import { useQuery } from "@tanstack/react-query";
import getGitlabIntegration from "@/fetchers/gitlab-integration/get-gitlab-integration";

function useGetGitlabIntegration(projectId: string) {
  return useQuery({
    queryKey: ["gitlab-integration", projectId],
    queryFn: () => getGitlabIntegration(projectId),
    enabled: !!projectId,
  });
}

export default useGetGitlabIntegration;
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @kaneo/web exec tsc --noEmit`
Expected: no errors — this is the step that actually validates the fetchers/hooks against the generated `client` type, since the API router changes from Tasks 7/8/14 are what shape `client["gitlab-integration"]`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/fetchers/gitlab-integration apps/web/src/hooks/mutations/gitlab-integration apps/web/src/hooks/queries/gitlab-integration
git commit -m "feat(web): add GitLab integration fetchers and hooks"
```

---

### Task 17: Web components — icon, repository browser, settings panel

**Files:**
- Create: `apps/web/src/components/icons/gitlab-icon.tsx`
- Create: `apps/web/src/components/project/gitlab-repository-browser-modal.tsx`
- Create: `apps/web/src/components/project/gitlab-integration-settings.tsx`

**Interfaces:**
- Consumes: all fetchers/hooks from Task 16; `listGitlabRepositories`, `type ListGitlabRepositoriesResponse` (Task 16); shadcn `Badge`/`Button`/`Dialog`/`Form`/`Input`/`Separator`/`Switch` components (existing, unmodified).
- Produces: `GitlabIcon` (component), `GitlabRepositoryBrowserModal` (component, props `{open, projectId, onOpenChange, onSelectRepository: (repository: {repositoryPath: string}) => void, selectedRepository?: string, baseUrl: string, accessToken: string}`), `GitlabIntegrationSettings` (component, props `{projectId: string}`). Task 18 imports all three into the project-settings integrations route and, for the icon, nowhere else.

The Gitea settings form has four fields (`baseUrl`, `accessToken`, `repositoryOwner`, `repositoryName`) because Gitea addresses a repo as owner+name. GitLab addresses a project by a single namespace path, so the form collapses to three fields (`baseUrl`, `accessToken`, `repositoryPath`) — everything else (verify-on-change debounce, webhook secret reveal/copy, import-issues gating on a fresh verification) is a direct port.

- [ ] **Step 1: Write the icon**

```typescript
// apps/web/src/components/icons/gitlab-icon.tsx
import type { SVGProps } from "react";

// lucide-react dropped its brand icons in v1, so the GitLab mark lives here.
export function GitlabIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M23.6004 9.5927l-.0337-.0862L20.3.9814a.851.851 0 00-.3362-.405.8748.8748 0 00-.9997.0539.8748.8748 0 00-.2941.4358l-2.2431 6.8579H7.5375L5.2932.9919a.8748.8748 0 00-.2941-.4358.8748.8748 0 00-.9997-.0539.8511.8511 0 00-.3362.405L.4332 9.5065l-.0325.0862a6.0657 6.0657 0 002.0119 7.0105l.0113.0087.03.0213 4.976 3.7264 2.462 1.8631 1.4995 1.1321a1.0021 1.0021 0 001.2151 0l1.4995-1.1321 2.462-1.8631 5.006-3.7489.0125-.01a6.0682 6.0682 0 002.0086-7.003z" />
    </svg>
  );
}
```

- [ ] **Step 2: Write the repository browser modal**

```typescript
// apps/web/src/components/project/gitlab-repository-browser-modal.tsx
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, GitBranch, Lock, Search } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import listGitlabRepositories, {
  type ListGitlabRepositoriesResponse,
} from "@/fetchers/gitlab-integration/list-gitlab-repositories";
import { cn } from "@/lib/cn";

type GitlabRepositoryBrowserModalProps = {
  open: boolean;
  projectId: string;
  onOpenChange: (open: boolean) => void;
  onSelectRepository: (repository: { repositoryPath: string }) => void;
  selectedRepository?: string;
  baseUrl: string;
  accessToken: string;
};

export function GitlabRepositoryBrowserModal({
  open,
  projectId,
  onOpenChange,
  onSelectRepository,
  selectedRepository,
  baseUrl,
  accessToken,
}: GitlabRepositoryBrowserModalProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = React.useState("");

  const canFetch =
    open && baseUrl.trim().length > 0 && accessToken.trim().length > 0;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["gitlab-repositories", projectId, baseUrl],
    queryFn: () => listGitlabRepositories({ projectId, baseUrl, accessToken }),
    enabled: canFetch,
  });

  const filteredRepositories = React.useMemo(() => {
    if (!data?.repositories) return [];

    if (!searchTerm) return data.repositories;

    const search = searchTerm.toLowerCase();
    return data.repositories.filter((repo) =>
      repo.path_with_namespace.toLowerCase().includes(search),
    );
  }, [data?.repositories, searchTerm]);

  const handleSelectRepository = (
    repository: ListGitlabRepositoriesResponse["repositories"][number],
  ) => {
    onSelectRepository({ repositoryPath: repository.path_with_namespace });
    resetAndCloseModal(false);
  };

  const resetAndCloseModal = (next: boolean) => {
    if (!next) {
      setSearchTerm("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndCloseModal}>
      <DialogContent className="!max-w-2xl max-h-[85vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="size-5" />
            {t("settings:gitlabIntegration.browseModalTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("settings:gitlabIntegration.browseModalHint")}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("settings:gitlabIntegration.searchRepos")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border-t border-border px-6 py-2">
          {!canFetch && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("settings:gitlabIntegration.browseNeedsCredentials")}
            </p>
          )}
          {canFetch && isLoading && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("settings:gitlabIntegration.loadingRepos")}
            </p>
          )}
          {canFetch && error && (
            <div className="py-6 text-center space-y-2">
              <p className="text-sm text-destructive">
                {error instanceof Error ? error.message : "Error"}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                {t("settings:gitlabIntegration.retry")}
              </Button>
            </div>
          )}
          {canFetch && data && (
            <ul className="space-y-1">
              {filteredRepositories.map((repo) => (
                <li key={repo.id}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectRepository(repo)}
                      className={cn(
                        "flex-1 flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/80 transition-colors",
                        selectedRepository === repo.path_with_namespace &&
                          "bg-muted",
                      )}
                    >
                      <span className="font-medium truncate">
                        {repo.path_with_namespace}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {repo.visibility !== "public" ? (
                          <Lock className="size-3.5 text-muted-foreground" />
                        ) : null}
                        <Badge variant="secondary" className="text-xs">
                          {repo.visibility}
                        </Badge>
                      </div>
                    </button>
                    <a
                      href={repo.web_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md p-2 text-primary hover:bg-muted/80 transition-colors"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Write the settings panel**

```typescript
// apps/web/src/components/project/gitlab-integration-settings.tsx
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  GitBranch,
  Import,
  Link,
  RefreshCw,
  Unlink,
  XCircle,
} from "lucide-react";
import React from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { GitlabRepositoryBrowserModal } from "@/components/project/gitlab-repository-browser-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { VerifyGitlabAccessResponse } from "@/fetchers/gitlab-integration/verify-gitlab-access";
import {
  useCreateGitlabIntegration,
  useDeleteGitlabIntegration,
  useVerifyGitlabAccess,
} from "@/hooks/mutations/gitlab-integration/use-create-gitlab-integration";
import useImportGitlabIssues from "@/hooks/mutations/gitlab-integration/use-import-gitlab-issues";
import { useUpdateGitlabIntegration } from "@/hooks/mutations/gitlab-integration/use-update-gitlab-integration";
import useGetGitlabIntegration from "@/hooks/queries/gitlab-integration/use-get-gitlab-integration";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

type GitlabIntegrationFormValues = {
  baseUrl: string;
  accessToken: string;
  repositoryPath: string;
};

type GitlabVerificationSnapshot = {
  baseUrl: string;
  accessToken: string;
  repositoryPath: string;
};

type GitlabVerificationState = {
  result: VerifyGitlabAccessResponse;
  verified: GitlabVerificationSnapshot;
};

function createVerificationSnapshot(
  values: GitlabIntegrationFormValues,
): GitlabVerificationSnapshot {
  return {
    baseUrl: values.baseUrl.trim(),
    accessToken: values.accessToken.trim(),
    repositoryPath: values.repositoryPath.trim(),
  };
}

export function GitlabIntegrationSettings({
  projectId,
}: {
  projectId: string;
}) {
  const { t } = useTranslation();

  const gitlabIntegrationSchema = React.useMemo(
    () =>
      z.object({
        baseUrl: z
          .string()
          .min(1, t("settings:gitlabIntegration.validation.baseUrlRequired"))
          .refine((s) => {
            try {
              new URL(s);
              return true;
            } catch {
              return false;
            }
          }, t("settings:gitlabIntegration.validation.baseUrlInvalid")),
        accessToken: z.string(),
        repositoryPath: z
          .string()
          .min(1, t("settings:gitlabIntegration.validation.pathRequired"))
          .regex(
            /^[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)+$/,
            t("settings:gitlabIntegration.validation.pathInvalid"),
          ),
      }),
    [t],
  );

  const {
    data: integration,
    isLoading,
    error: integrationError,
    refetch: refetchIntegration,
  } = useGetGitlabIntegration(projectId);
  const { mutateAsync: createIntegration, isPending: isCreating } =
    useCreateGitlabIntegration();
  const { mutateAsync: deleteIntegration, isPending: isDeleting } =
    useDeleteGitlabIntegration();
  const { mutateAsync: verifyAccess, isPending: isVerifying } =
    useVerifyGitlabAccess();
  const { mutateAsync: importIssues, isPending: isImporting } =
    useImportGitlabIssues();
  const { mutateAsync: updateGitlabSettings, isPending: isUpdatingSettings } =
    useUpdateGitlabIntegration();

  const [verificationResult, setVerificationResult] =
    React.useState<GitlabVerificationState | null>(null);
  const [showRepositoryBrowser, setShowRepositoryBrowser] =
    React.useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = React.useState(false);

  const form = useForm<GitlabIntegrationFormValues>({
    resolver: standardSchemaResolver(gitlabIntegrationSchema),
    defaultValues: {
      baseUrl: "",
      accessToken: "",
      repositoryPath: "",
    },
  });

  const resetIntegrationForm = React.useCallback(() => {
    if (!integration?.baseUrl) {
      return;
    }

    form.reset({
      baseUrl: integration.baseUrl,
      accessToken: "",
      repositoryPath: integration.repositoryPath,
    });
    // Intentionally clear verify state after reload: import must not run until the user re-verifies (token/URL may have changed).
    setVerificationResult(null);
    setShowWebhookSecret(false);
  }, [form.reset, integration?.baseUrl, integration?.repositoryPath]);

  React.useEffect(() => {
    resetIntegrationForm();
  }, [resetIntegrationForm]);

  const runVerify = React.useCallback(
    async (data: GitlabIntegrationFormValues, showToast = true) => {
      const token = data.accessToken.trim();
      if (!token && integration) {
        return;
      }
      if (!token && !integration) {
        if (showToast) {
          toast.error(
            t("settings:gitlabIntegration.toast.tokenRequiredVerify"),
          );
        }
        setVerificationResult(null);
        return;
      }
      try {
        const snapshot = createVerificationSnapshot(data);
        const result = await verifyAccess({
          projectId,
          baseUrl: snapshot.baseUrl,
          accessToken: snapshot.accessToken,
          repositoryPath: snapshot.repositoryPath,
        });
        setVerificationResult({
          result,
          verified: snapshot,
        });
        if (showToast) {
          if (result.isInstalled && result.hasRequiredPermissions) {
            toast.success(t("settings:gitlabIntegration.toast.verifyOk"));
          } else if (result.failureReason === "redirected") {
            toast.error(t("settings:gitlabIntegration.toast.redirected"));
          } else if (result.failureReason === "not_a_gitlab_instance") {
            toast.error(
              t("settings:gitlabIntegration.toast.notGitlabInstance"),
            );
          } else if (result.failureReason === "repository_not_found") {
            toast.error(t("settings:gitlabIntegration.toast.repoNotFound"));
          } else {
            toast.warning(t("settings:gitlabIntegration.toast.verifyWarning"));
          }
        }
      } catch (error) {
        if (showToast) {
          toast.error(
            error instanceof Error
              ? error.message
              : t("settings:gitlabIntegration.toast.verifyError"),
          );
        }
        setVerificationResult(null);
      }
    },
    [verifyAccess, integration, projectId, t],
  );

  const baseUrl = form.watch("baseUrl");
  const accessToken = form.watch("accessToken");
  const repositoryPath = form.watch("repositoryPath");
  const currentVerificationSnapshot = React.useMemo(
    () => createVerificationSnapshot({ baseUrl, accessToken, repositoryPath }),
    [baseUrl, accessToken, repositoryPath],
  );

  React.useEffect(() => {
    setVerificationResult((current) => {
      if (!current) {
        return current;
      }

      const stillMatches =
        current.verified.baseUrl === currentVerificationSnapshot.baseUrl &&
        current.verified.accessToken ===
          currentVerificationSnapshot.accessToken &&
        current.verified.repositoryPath ===
          currentVerificationSnapshot.repositoryPath;

      return stillMatches ? current : null;
    });
  }, [currentVerificationSnapshot]);

  React.useEffect(() => {
    if (!baseUrl || !repositoryPath || !form.formState.isValid) {
      return;
    }
    if (!accessToken.trim()) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      runVerify(form.getValues(), false);
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    baseUrl,
    repositoryPath,
    accessToken,
    form.formState.isValid,
    runVerify,
    form.getValues,
  ]);

  const onSubmit = async (data: GitlabIntegrationFormValues) => {
    try {
      if (!data.accessToken.trim() && !integration) {
        toast.error(t("settings:gitlabIntegration.toast.tokenRequired"));
        return;
      }

      const snapshot = createVerificationSnapshot(data);
      const hasMatchingVerification =
        verificationResult?.result.isInstalled &&
        verificationResult.result.hasRequiredPermissions &&
        verificationResult.verified.baseUrl === snapshot.baseUrl &&
        verificationResult.verified.accessToken === snapshot.accessToken &&
        verificationResult.verified.repositoryPath === snapshot.repositoryPath;

      if (data.accessToken.trim() && !hasMatchingVerification) {
        const verification = await verifyAccess({
          projectId,
          baseUrl: snapshot.baseUrl,
          accessToken: snapshot.accessToken,
          repositoryPath: snapshot.repositoryPath,
        });

        if (!verification.isInstalled || !verification.hasRequiredPermissions) {
          toast.error(t("settings:gitlabIntegration.toast.verifyFirst"));
          return;
        }
      }

      await createIntegration({
        projectId,
        data: {
          baseUrl: data.baseUrl,
          ...(data.accessToken.trim()
            ? { accessToken: data.accessToken.trim() }
            : {}),
          repositoryPath: data.repositoryPath,
        },
      });
      form.setValue("accessToken", "");
      toast.success(t("settings:gitlabIntegration.toast.updated"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:gitlabIntegration.toast.updateError"),
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteIntegration(projectId);
      form.reset({ baseUrl: "", accessToken: "", repositoryPath: "" });
      setVerificationResult(null);
      toast.success(t("settings:gitlabIntegration.toast.removed"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:gitlabIntegration.toast.removeError"),
      );
    }
  };

  const handleImportIssues = async () => {
    try {
      await importIssues(projectId);
      toast.success(t("settings:gitlabIntegration.toast.issuesImported"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:gitlabIntegration.toast.importError"),
      );
    }
  };

  const handleRepositorySelect = (repository: { repositoryPath: string }) => {
    form.setValue("repositoryPath", repository.repositoryPath, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
    setShowRepositoryBrowser(false);
    setVerificationResult(null);
  };

  const handleCopyWebhookSecret = React.useCallback(async () => {
    if (!integration?.webhookSecret) {
      return;
    }

    try {
      await navigator.clipboard.writeText(integration.webhookSecret);
      toast.success(t("settings:gitlabIntegration.toast.secretCopied"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:gitlabIntegration.toast.unableToCopySecret"),
      );
    }
  }, [integration?.webhookSecret, t]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted rounded animate-pulse w-full" />
      </div>
    );
  }

  if (integrationError) {
    return (
      <div className="space-y-4 border border-destructive/25 rounded-md p-4 bg-sidebar">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">
              {t("common:error.title")}
            </p>
            <p className="text-sm text-muted-foreground">
              {integrationError instanceof Error
                ? integrationError.message
                : t("settings:gitlabIntegration.toast.updateError")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetchIntegration()}
          >
            {t("settings:gitlabIntegration.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const isConnected = !!integration && integration.isActive;
  const hasVerifiedCurrentValues =
    verificationResult?.result.isInstalled &&
    verificationResult.result.hasRequiredPermissions &&
    verificationResult.verified.baseUrl ===
      currentVerificationSnapshot.baseUrl &&
    verificationResult.verified.accessToken ===
      currentVerificationSnapshot.accessToken &&
    verificationResult.verified.repositoryPath ===
      currentVerificationSnapshot.repositoryPath;
  const canImport = isConnected && Boolean(hasVerifiedCurrentValues);

  const repoUrl =
    integration?.baseUrl && integration.repositoryPath
      ? `${integration.baseUrl.replace(/\/$/, "")}/${integration.repositoryPath}`
      : null;

  return (
    <div className="space-y-4">
      <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {t("settings:gitlabIntegration.connectionStatus")}
            </p>
            {isConnected ? (
              <p className="text-xs text-muted-foreground">
                {t("settings:gitlabIntegration.connectedActive")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("settings:gitlabIntegration.notConnectedHint")}
              </p>
            )}
          </div>
          {isConnected ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle className="w-3 h-3" />
              {t("settings:gitlabIntegration.badgeConnected")}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <XCircle className="w-3 h-3" />
              {t("settings:gitlabIntegration.badgeNotConnected")}
            </Badge>
          )}
        </div>

        {isConnected && integration && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t("settings:gitlabIntegration.repository")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:gitlabIntegration.repositoryHint")}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{integration.repositoryPath}</span>
                {repoUrl && (
                  <a
                    href={repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium">
                  {t("settings:gitlabIntegration.commentTaskLinkTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:gitlabIntegration.commentTaskLinkHint")}
                </p>
              </div>
              <Switch
                checked={integration.commentTaskLinkOnGitlabIssue ?? true}
                onCheckedChange={async (checked) => {
                  try {
                    await updateGitlabSettings({
                      projectId,
                      json: { commentTaskLinkOnGitlabIssue: checked },
                    });
                    toast.success(
                      checked
                        ? t("settings:gitlabIntegration.toast.commentOnEnabled")
                        : t(
                            "settings:gitlabIntegration.toast.commentOnDisabled",
                          ),
                    );
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : t(
                            "settings:gitlabIntegration.toast.settingsUpdateError",
                          ),
                    );
                  }
                }}
                disabled={isUpdatingSettings}
              />
            </div>

            {integration.webhookUrl && (
              <>
                <Separator />
                <div className="space-y-2 text-xs">
                  <p className="font-medium text-sm">
                    {t("settings:gitlabIntegration.webhookTitle")}
                  </p>
                  <p className="text-muted-foreground">
                    {t("settings:gitlabIntegration.webhookHint")}
                  </p>
                  <code className="block break-all rounded bg-muted px-2 py-1 text-[11px]">
                    {integration.webhookUrl}
                  </code>
                  <p className="text-muted-foreground mt-2">
                    {t("settings:gitlabIntegration.webhookSecretLabel")}
                  </p>
                  <div className="flex items-start gap-2">
                    <code className="block flex-1 break-all rounded bg-muted px-2 py-1 text-[11px]">
                      {showWebhookSecret
                        ? integration.webhookSecret
                        : "••••••••••••••••••••••••••••••••"}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setShowWebhookSecret((current) => !current)
                      }
                    >
                      {showWebhookSecret
                        ? t("settings:gitlabIntegration.webhookHide")
                        : t("settings:gitlabIntegration.webhookShow")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyWebhookSecret}
                    >
                      {t("settings:gitlabIntegration.webhookCopy")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="baseUrl"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        {t("settings:gitlabIntegration.baseUrlLabel")}
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("settings:gitlabIntegration.baseUrlHint")}
                      </p>
                    </div>
                    <FormControl>
                      <Input
                        className="w-72"
                        placeholder="https://gitlab.com"
                        {...field}
                        disabled={isCreating || isDeleting}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="accessToken"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        {t("settings:gitlabIntegration.tokenLabel")}
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("settings:gitlabIntegration.tokenHint")}
                        {integration?.maskedAccessToken
                          ? ` (${t("settings:gitlabIntegration.currentToken")}: ${integration.maskedAccessToken})`
                          : null}
                      </p>
                    </div>
                    <FormControl>
                      <Input
                        className="w-72"
                        type="password"
                        autoComplete="off"
                        placeholder={
                          integration
                            ? t(
                                "settings:gitlabIntegration.tokenPlaceholderUpdate",
                              )
                            : t("settings:gitlabIntegration.tokenPlaceholder")
                        }
                        {...field}
                        disabled={isCreating || isDeleting}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="repositoryPath"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        {t("settings:gitlabIntegration.pathLabel")}
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("settings:gitlabIntegration.pathHint")}
                      </p>
                    </div>
                    <FormControl>
                      <Input
                        className="w-72"
                        placeholder="group/subgroup/project"
                        {...field}
                        disabled={isCreating || isDeleting}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t("settings:gitlabIntegration.actionsTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:gitlabIntegration.actionsHint")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRepositoryBrowser(true)}
                  className="gap-2"
                  disabled={!baseUrl || !accessToken.trim()}
                >
                  <GitBranch className="size-3" />
                  {t("settings:gitlabIntegration.browse")}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => runVerify(form.getValues())}
                  disabled={
                    isVerifying ||
                    !form.formState.isValid ||
                    (!accessToken.trim() && !integration)
                  }
                  className="gap-2"
                >
                  <RefreshCw
                    className={cn("size-3", isVerifying && "animate-spin")}
                  />
                  {t("settings:gitlabIntegration.verify")}
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    isCreating ||
                    isDeleting ||
                    !form.formState.isValid ||
                    (verificationResult ? !hasVerifiedCurrentValues : false)
                  }
                  className="gap-2"
                >
                  <Link className="size-3" />
                  {isConnected
                    ? t("settings:gitlabIntegration.update")
                    : t("settings:gitlabIntegration.connect")}
                </Button>

                {isConnected && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isCreating || isDeleting}
                    className="gap-2"
                  >
                    <Unlink className="size-3" />
                    {t("settings:gitlabIntegration.disconnect")}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>

        {verificationResult && (
          <>
            <Separator />
            <div
              className={cn(
                "flex items-start gap-3 p-3 border rounded-md text-sm",
                verificationResult.result.isInstalled &&
                  verificationResult.result.hasRequiredPermissions
                  ? "border-success/25 bg-success/10"
                  : verificationResult.result.failureReason
                    ? "border-destructive/25 bg-destructive/10"
                    : "border-warning/25 bg-warning/10",
              )}
            >
              {verificationResult.result.isInstalled &&
              verificationResult.result.hasRequiredPermissions ? (
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-foreground" />
              ) : verificationResult.result.failureReason ? (
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive-foreground" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-foreground" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {verificationResult.result.message}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {isConnected && (
        <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {t("settings:gitlabIntegration.importSectionTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("settings:gitlabIntegration.importSectionHint")}
              </p>
            </div>
            <Button
              onClick={handleImportIssues}
              disabled={isImporting || !canImport}
              className="gap-2"
              size="sm"
              variant="outline"
            >
              {isImporting ? (
                <RefreshCw className="size-3 animate-spin" />
              ) : (
                <Import className="size-3" />
              )}
              {isImporting
                ? t("settings:gitlabIntegration.importing")
                : t("settings:gitlabIntegration.importIssues")}
            </Button>
          </div>
          {!canImport && (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground">
                {t("settings:gitlabIntegration.importDisabledHint")}
              </p>
            </>
          )}
        </div>
      )}

      <GitlabRepositoryBrowserModal
        open={showRepositoryBrowser}
        projectId={projectId}
        onOpenChange={setShowRepositoryBrowser}
        onSelectRepository={handleRepositorySelect}
        selectedRepository={repositoryPath || undefined}
        baseUrl={baseUrl}
        accessToken={accessToken}
      />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @kaneo/web exec tsc --noEmit`
Expected: no errors — the i18n keys referenced here (`settings:gitlabIntegration.*`) don't exist yet and get added in Task 18; if this project's i18n typing setup flags missing keys at compile time, run Task 18's i18n step first and revisit this typecheck after. If keys are only validated at runtime, this passes now.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/icons/gitlab-icon.tsx apps/web/src/components/project/gitlab-repository-browser-modal.tsx apps/web/src/components/project/gitlab-integration-settings.tsx
git commit -m "feat(web): add GitLab integration settings UI"
```

---

### Task 18: Wire into the integrations page, workflow editor, and i18n

**Files:**
- Modify: `apps/web/src/routes/_layout/_authenticated/dashboard/settings/projects/$projectId/integrations.tsx`
- Modify: `apps/web/src/components/project/workflow-editor.tsx`
- Modify: `i18n/en-US.json`

**Interfaces:**
- Consumes: `GitlabIntegrationSettings` (Task 17), `GitlabIcon` (Task 17).
- Produces: a new collapsible "GitLab Integration" section on the project integrations settings page, and a new "GitLab" workflow-rule section using `integrationType: "gitlab"` (already valid — `apps/api/src/workflow-rule/index.ts` validates `integrationType` as a plain `v.string()`, so no backend change is needed for this to work end to end).

- [ ] **Step 1: Add the section to the integrations route**

In `apps/web/src/routes/_layout/_authenticated/dashboard/settings/projects/$projectId/integrations.tsx`, add the import next to the Gitea one:

```typescript
import { GitlabIcon } from "@/components/icons/gitlab-icon";
import { GitlabIntegrationSettings } from "@/components/project/gitlab-integration-settings";
```

Add a new `IntegrationSection` block right after the Gitea one:

```typescript
          <IntegrationSection
            icon={<GitlabIcon className="size-4" />}
            subtitle={t("settings:projectIntegrations.gitlabSectionSubtitle")}
            title={t("settings:projectIntegrations.gitlabSectionTitle")}
          >
            <GitlabIntegrationSettings projectId={projectId} />
          </IntegrationSection>
```

- [ ] **Step 2: Add the GitLab section to the workflow editor**

In `apps/web/src/components/project/workflow-editor.tsx`, widen the `renderRuleSection` parameter types and add a third call:

```typescript
  const renderRuleSection = (
    integrationType: "github" | "gitea" | "gitlab",
    headingKey: "githubHeading" | "giteaHeading" | "gitlabHeading",
    hintKey: "githubHint" | "giteaHint" | "gitlabHint",
  ) => (
```

```typescript
  return (
    <div className="space-y-10">
      {renderRuleSection("github", "githubHeading", "githubHint")}
      {renderRuleSection("gitea", "giteaHeading", "giteaHint")}
      {renderRuleSection("gitlab", "gitlabHeading", "gitlabHint")}
    </div>
  );
```

- [ ] **Step 3: Add the i18n keys to `i18n/en-US.json`**

Add `gitlabSectionTitle`/`gitlabSectionSubtitle` to the `projectIntegrations` object, right after the Gitea keys:

```json
			"gitlabSectionTitle": "GitLab Integration",
			"gitlabSectionSubtitle": "Synchronize tasks with GitLab.com or a self-hosted GitLab instance (issues, merge requests, webhooks).",
```

Add a `gitlabIntegration` object as a sibling of `giteaIntegration`, following the same shape (note the collapsed `pathRequired`/`pathInvalid` validation pair replacing Gitea's separate owner/name pair, and `notGitlabInstance` replacing `notGiteaInstance`):

```json
		"gitlabIntegration": {
			"validation": {
				"baseUrlRequired": "GitLab base URL is required",
				"baseUrlInvalid": "Enter a valid URL (e.g. https://gitlab.example.com)",
				"pathRequired": "Project path is required",
				"pathInvalid": "Use the full path as it appears in the URL (e.g. group/subgroup/project)"
			},
			"toast": {
				"verifyOk": "GitLab token can access this project",
				"verifyWarning": "Check token permissions or project access",
				"repoNotFound": "Project not found or not accessible",
				"redirected": "GitLab URL redirected (usually to HTTPS). Use the final URL directly.",
				"notGitlabInstance": "The URL does not point to a GitLab instance",
				"verifyError": "Failed to verify GitLab access",
				"tokenRequired": "Personal access token is required",
				"tokenRequiredVerify": "Enter a token to verify",
				"verifyFirst": "Verify access failed. Check URL, token, and project path",
				"updated": "GitLab integration saved",
				"updateError": "Failed to save GitLab integration",
				"removed": "GitLab integration removed",
				"removeError": "Failed to remove GitLab integration",
				"issuesImported": "Issues imported successfully",
				"importError": "Failed to import issues",
				"commentOnEnabled": "Kaneo will comment with a task link on new issues",
				"commentOnDisabled": "Task link comments on new issues are turned off",
				"settingsUpdateError": "Failed to update GitLab integration",
				"secretCopied": "Copied",
				"unableToCopySecret": "Unable to copy secret"
			},
			"webhookShow": "Show",
			"webhookHide": "Hide",
			"webhookCopy": "Copy",
			"connectionStatus": "Connection status",
			"connectedActive": "Project connected and active",
			"notConnectedHint": "No GitLab project connected",
			"badgeConnected": "Connected",
			"badgeNotConnected": "Not connected",
			"repository": "Project",
			"repositoryHint": "Linked GitLab project",
			"commentTaskLinkTitle": "Comment Kaneo link on new issues",
			"commentTaskLinkHint": "When enabled, Kaneo posts a comment on each new issue with a link to the task.",
			"webhookTitle": "Webhook",
			"webhookHint": "In your GitLab project, add a webhook with this URL and secret token under Settings → Webhooks. Enable push, issues, merge request, and comment events.",
			"webhookSecretLabel": "Secret token (must match the webhook secret token in GitLab)",
			"baseUrlLabel": "GitLab URL",
			"baseUrlHint": "Root URL of GitLab.com or your self-hosted instance",
			"tokenLabel": "Personal access token",
			"tokenHint": "Token with api and read_repository scope",
			"tokenPlaceholder": "Paste token",
			"tokenPlaceholderUpdate": "Paste new token to rotate",
			"currentToken": "stored",
			"pathLabel": "Project path",
			"pathHint": "Full namespace path as it appears in the URL",
			"actionsTitle": "Actions",
			"actionsHint": "Verify access and connect",
			"browse": "Browse",
			"verify": "Verify",
			"update": "Update",
			"connect": "Connect",
			"disconnect": "Disconnect",
			"importSectionTitle": "Import GitLab issues",
			"importSectionHint": "Import open issues and merge requests from the project",
			"importing": "Importing…",
			"importIssues": "Import issues",
			"importDisabledHint": "Verify the project above to enable importing",
			"browseModalTitle": "Browse GitLab projects",
			"browseModalHint": "Select a project accessible with this token",
			"searchRepos": "Search projects...",
			"browseNeedsCredentials": "Enter a GitLab URL and access token to browse projects",
			"loadingRepos": "Loading projects...",
			"retry": "Retry"
		},
```

Add `gitlabHeading`/`gitlabHint` to the `workflowEditor` object, right after the Gitea keys:

```json
				"gitlabHeading": "GitLab",
				"gitlabHint": "When a GitLab webhook event occurs, move the linked task to a column.",
```

- [ ] **Step 4: Typecheck and lint the JSON**

Run: `pnpm --filter @kaneo/web exec tsc --noEmit`
Expected: no errors.

Run: `node -e "JSON.parse(require('fs').readFileSync('i18n/en-US.json', 'utf8'))"`
Expected: no output (valid JSON) — confirms no trailing-comma or bracket mistakes from the manual edits above.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/_layout/_authenticated/dashboard/settings/projects/\$projectId/integrations.tsx apps/web/src/components/project/workflow-editor.tsx i18n/en-US.json
git commit -m "feat(web): surface GitLab integration in project settings and workflow rules"
```

---

### Task 19: Postgres-backed authorization and secret-redaction coverage

**Files:**
- Modify: `tests/api-integration/authorization-boundaries.test.ts`
- Modify: `tests/api-integration/external-link-secrets.test.ts`

**Interfaces:**
- Consumes: `createApp` (`apps/api/src/index.ts`), `mockAuthenticatedSession`, `resetTestDatabase`, `createProjectFixture`, `createWorkspaceMember` (existing test helpers, unmodified).
- Produces: no new production code — this task only adds test cases to two existing Postgres-backed suites, run via `pnpm --filter @kaneo/api test:integration` (confirm the exact script name in `apps/api/package.json` during execution; it is not `test:unit`).

Neither of these suites has a dedicated Gitea `describe` block today — `authorization-boundaries.test.ts` only covers `github-integration`, and `external-link-secrets.test.ts` has exactly one Gitea-flavored case. This task adds the GitLab-equivalent coverage matching what GitHub already has and what Gitea already has, rather than "restoring parity with an existing Gitea entry" that doesn't itself exist for the authorization suite.

- [ ] **Step 1: Add a GitLab workspace-scoping `describe` block to `authorization-boundaries.test.ts`**

Add this block right after the existing `describe("github integration routes are workspace scoped", ...)` block. Note the request shape differs from GitHub's on purpose: the GitLab (and Gitea) router takes `projectId` in the POST body rather than as a URL param, since there's no App-installation step to look the project up from first.

```typescript
describe("gitlab integration routes are workspace scoped", () => {
  it("refuses to list repositories for a member without manage_settings", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "member" });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/gitlab-integration/repositories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        baseUrl: "https://gitlab.example",
        accessToken: "token",
      }),
    });

    expect(response.status).toBe(403);
  });

  it("refuses to verify access for a member without manage_settings", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "member" });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/gitlab-integration/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        baseUrl: "https://gitlab.example",
        accessToken: "token",
        repositoryPath: "group/project",
      }),
    });

    expect(response.status).toBe(403);
  });

  it("refuses to read the integration for a project in another workspace", async () => {
    const outsider = await createWorkspaceMember({ role: "owner" });
    const other = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: other.workspace.id,
    });

    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/gitlab-integration/project/${project.id}`,
    );

    expect(response.status).toBe(403);
  });
});
```

- [ ] **Step 2: Add a GitLab secret-redaction case to `external-link-secrets.test.ts`**

Add the two constants next to the existing Gitea ones:

```typescript
const GITLAB_TOKEN = "gitlab-pat-should-never-be-exposed";
const GITLAB_WEBHOOK_SECRET = "gitlab-webhook-secret-should-never-be-exposed";
```

Add this `it` inside the existing `describe("API integration: external link integration secrets", ...)` block, right after the Gitea case:

```typescript
  it("does not expose GitLab integration config to a workspace viewer", async () => {
    const viewer = await createWorkspaceMember({ role: "viewer" });
    const { project, columns } = await createProjectFixture({
      workspaceId: viewer.workspace.id,
    });

    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Task with a linked GitLab issue",
        status: "to-do",
        columnId: columns.todo.id,
        priority: "medium",
        number: 1,
        position: 1,
      })
      .returning();

    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type: "gitlab",
        config: JSON.stringify({
          baseUrl: "https://gitlab.example",
          accessToken: GITLAB_TOKEN,
          repositoryPath: "group/project",
          webhookSecret: GITLAB_WEBHOOK_SECRET,
        }),
        isActive: true,
      })
      .returning();

    await db.insert(schema.externalLinkTable).values({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: "1",
      url: "https://gitlab.example/group/project/-/issues/1",
      title: "Linked issue",
    });

    mockAuthenticatedSession(viewer.user);

    const { app } = createApp();
    const response = await app.request(`/api/external-link/task/${task.id}`);

    expect(response.status).toBe(200);
    const body = await response.text();

    expect(body).not.toContain(GITLAB_TOKEN);
    expect(body).not.toContain(GITLAB_WEBHOOK_SECRET);
    expect(body).not.toContain("config");

    const links = JSON.parse(body);
    expect(links).toHaveLength(1);
    expect(links[0].integration).toEqual({
      id: integration.id,
      type: "gitlab",
    });
  });
```

- [ ] **Step 3: Run the integration suite**

Run: `pnpm --filter @kaneo/api test:integration` (verify the script name against `apps/api/package.json` first — adjust if it differs; this requires a running PostgreSQL test database per `ENVIRONMENT_SETUP.md`, never production credentials)
Expected: all cases pass, including the three new GitLab ones in each file.

- [ ] **Step 4: Commit**

```bash
git add tests/api-integration/authorization-boundaries.test.ts tests/api-integration/external-link-secrets.test.ts
git commit -m "test(api): cover GitLab integration authorization and secret redaction"
```

---

## Final verification

After Task 19, run the full check set once before considering this complete:

- [ ] `pnpm --filter @kaneo/api test:unit` — all GitLab unit tests (Tasks 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15) plus the full existing suite pass.
- [ ] `pnpm --filter @kaneo/api test:integration` — Task 19's cases plus the full existing Postgres-backed suite pass.
- [ ] `pnpm --filter @kaneo/api exec tsc --noEmit` and `pnpm --filter @kaneo/web exec tsc --noEmit` — no type errors anywhere touched.
- [ ] `node -e "JSON.parse(require('fs').readFileSync('i18n/en-US.json', 'utf8'))"` — i18n file is still valid JSON.
- [ ] Manual smoke pass (see `run` skill / `verify` project skill): start the API and web dev servers, open a project's Integrations settings page, confirm the new "GitLab Integration" section renders, the form validates a `group/subgroup/project` path, and the workflow editor shows a "GitLab" rule section.

