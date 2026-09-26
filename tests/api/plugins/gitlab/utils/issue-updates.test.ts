import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGitlabClient } from "../../../../../apps/api/src/plugins/gitlab/utils/gitlab-api";
import { updateIssueLabelsGitlab } from "../../../../../apps/api/src/plugins/gitlab/utils/labels";

vi.mock("node:timers/promises", () => ({ setTimeout: vi.fn(async () => {}) }));
vi.mock("../../../../../apps/api/src/utils/assert-public-destination", () => ({
  assertPublicDestination: vi.fn(async () => {}),
}));
const config = {
  baseUrl: "https://gitlab.example",
  accessToken: "test-token",
  projectPath: "group/nested/project",
};
const client = createGitlabClient(config);
const fetchMock = vi.fn<typeof fetch>();
const lock = () =>
  new Response(
    JSON.stringify({ message: "409 Conflict: Resource lock" }, null, 2),
    { status: 409 },
  );
const issue = { iid: 1, title: "Updated" };
beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("GitLab issue update recovery", () => {
  it("retries a temporary resource lock with the same update and backoff", async () => {
    fetchMock
      .mockResolvedValueOnce(lock())
      .mockResolvedValueOnce(lock())
      .mockResolvedValueOnce(Response.json(issue));
    await expect(
      client.updateIssue(config.projectPath, 1, { description: "New body" }),
    ).resolves.toEqual(issue);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe(
        "https://gitlab.example/api/v4/projects/group%2Fnested%2Fproject/issues/1",
      );
      expect(init).toMatchObject({
        method: "PUT",
        body: JSON.stringify({ description: "New body" }),
        redirect: "manual",
      });
    }
    expect(vi.mocked(delay).mock.calls.map(([ms]) => ms)).toEqual([250, 500]);
  });
  it("bounds retries and surfaces a persistent lock", async () => {
    fetchMock.mockImplementation(async () => lock());
    await expect(
      client.updateIssue(config.projectPath, 1, { title: "New" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(vi.mocked(delay).mock.calls.map(([ms]) => ms)).toEqual([
      250, 500, 1000,
    ]);
  });
  it.each([
    [409, '{"message":"Other conflict"}'],
    [409, "invalid json"],
    [401, '{"message":"Unauthorized"}'],
    [500, '{"message":"409 Conflict: Resource lock"}'],
  ])("does not retry other failures (%s, %s)", async (status, body) => {
    fetchMock.mockResolvedValue(new Response(body, { status }));
    await expect(
      client.updateIssue(config.projectPath, 1, { title: "New" }),
    ).rejects.toMatchObject({ status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });
  it("does not replay issue or comment creation", async () => {
    fetchMock.mockImplementation(async () => lock());
    await expect(
      client.createIssue(config.projectPath, { title: "New" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      client.createIssueNote(config.projectPath, 1, "Comment"),
    ).rejects.toMatchObject({ status: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(delay).not.toHaveBeenCalled();
  });
  it("does not replay an ambiguous network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      client.updateIssue(config.projectPath, 1, { title: "New" }),
    ).rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("GitLab label reapplication", () => {
  it.each(["priority:medium", "status:to-do"])(
    "preserves %s when it is added and removed together",
    async (name) => {
      fetchMock
        .mockResolvedValueOnce(Response.json([{ id: 1, name }]))
        .mockResolvedValueOnce(Response.json(issue));
      await updateIssueLabelsGitlab(config, 1, { add: [name], remove: [name] });
      expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
        add_labels: name,
      });
    },
  );
  it("still removes a replaced label", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json([{ id: 1, name: "priority:high" }]))
      .mockResolvedValueOnce(Response.json(issue));
    await updateIssueLabelsGitlab(config, 1, {
      add: ["priority:high"],
      remove: ["priority:medium"],
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      add_labels: "priority:high",
      remove_labels: "priority:medium",
    });
  });
});
