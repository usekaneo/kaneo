import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const env = {
  GITHUB_REPOSITORY: "usekaneo/kaneo",
  GH_TOKEN: "local-test-token",
};
export const event = { pull_request: { number: 42 } };
export const pull = {
  number: 42,
  state: "open",
  user: { login: "contributor" },
  changed_files: 0,
  head: { sha: "a".repeat(40), repo: { full_name: "contributor/fork" } },
  base: { sha: "b".repeat(40) },
  labels: [],
};

export function sourceFile(source, filename = "source.ts") {
  const data = Buffer.from(source);
  const sha = createHash("sha1")
    .update(`blob ${data.length}\0`)
    .update(data)
    .digest("hex");
  const lines = source.split("\n");
  return {
    filename,
    sha,
    status: "added",
    additions: lines.length,
    deletions: 0,
    patch: `@@ -0,0 +1,${lines.length} @@\n${lines.map((line) => `+${line}`).join("\n")}`,
    blob: {
      sha,
      size: data.length,
      encoding: "base64",
      content: data.toString("base64"),
    },
  };
}

export function fixture(options = {}) {
  const files = options.files ?? [];
  const state = {
    pull: structuredClone({
      ...pull,
      changed_files: files.length,
      ...options.pull,
    }),
    files,
    comments: structuredClone(options.comments ?? []),
    labelExists: options.labelExists ?? true,
    calls: [],
    reads: 0,
  };
  const response = (data, status = 200) =>
    new Response(status === 204 ? null : JSON.stringify(data), { status });
  const fetcher = async (url, request) => {
    assert.equal(request.redirect, "error");
    assert.equal(request.headers.Authorization, "Bearer local-test-token");
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://api.github.com");
    const pathname = parsed.pathname;
    const method = request.method;
    const body = request.body ? JSON.parse(request.body) : undefined;
    state.calls.push({ pathname, method, body });
    if (options.intercept) {
      const intercepted = await options.intercept({
        pathname,
        method,
        body,
        state,
        response,
      });
      if (intercepted) return intercepted;
    }
    const root = "/repos/usekaneo/kaneo";
    const issue = `${root}/issues/42`;
    if (
      pathname ===
        `${root}/collaborators/${encodeURIComponent(state.pull.user?.login)}/permission` &&
      method === "GET"
    ) {
      return response(
        options.authorAccess ?? { permission: "read", role_name: "read" },
      );
    }
    if (pathname === `${root}/pulls/42` && method === "GET") {
      state.reads++;
      const data = structuredClone(state.pull);
      if (state.reads > 1 && options.stale) data.head.sha = "c".repeat(40);
      if (state.reads > 1 && options.staleBase) data.base.sha = "d".repeat(40);
      return response(data);
    }
    if (
      pathname === `${root}/pulls/42/files` ||
      (pathname === `${issue}/comments` && method === "GET")
    ) {
      const page = Number(parsed.searchParams.get("page"));
      assert.equal(parsed.searchParams.get("per_page"), "100");
      const items = pathname.endsWith("/files") ? files : state.comments;
      return response(items.slice((page - 1) * 100, page * 100));
    }
    if (pathname.includes("/git/blobs/")) {
      const file = files.find(
        (entry) => entry.sha === pathname.split("/").at(-1),
      );
      assert.ok(file, "Only requested PR blob SHAs may be read");
      return response(file.blob);
    }
    if (pathname === `${root}/labels/slop` && method === "GET") {
      return response(
        state.labelExists ? { name: "slop" } : {},
        state.labelExists ? 200 : 404,
      );
    }
    if (pathname === `${root}/labels` && method === "POST") {
      assert.equal(body.name, "slop");
      state.labelExists = true;
      return response(body, 201);
    }
    if (pathname === `${issue}/comments` && method === "POST") {
      const comment = {
        id: 123,
        body: body.body,
        user: { login: "github-actions[bot]", type: "Bot" },
      };
      state.comments.push(comment);
      return response(comment, 201);
    }
    if (pathname.startsWith(`${root}/issues/comments/`) && method === "PATCH") {
      const comment = state.comments.find(
        (entry) => String(entry.id) === pathname.split("/").at(-1),
      );
      assert.ok(comment);
      comment.body = body.body;
      return response(comment);
    }
    if (pathname === `${issue}/labels` && method === "POST") {
      assert.deepEqual(body.labels, ["slop"]);
      state.pull.labels.push({ name: "slop" });
      return response(state.pull.labels);
    }
    if (pathname === `${issue}/labels/slop` && method === "DELETE") {
      state.pull.labels = state.pull.labels.filter(
        (label) => label.name !== "slop",
      );
      return response(null, 204);
    }
    throw new Error(`Unexpected test request: ${method} ${pathname}`);
  };
  return { state, fetcher };
}

export const flagged = async () => ({ flagged: true, matches: [{}, {}] });
export const clear = async () => ({ flagged: false, matches: [] });
export const writes = (state) =>
  state.calls.filter((call) => call.method !== "GET");
