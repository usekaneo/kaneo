import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import listGitlabProjects from "@/fetchers/gitlab-integration/list-gitlab-projects";
import verifyGitlabAccess from "@/fetchers/gitlab-integration/verify-gitlab-access";
import queryClient from "./index";

const { handleUnauthorized, listProjects, verify } = vi.hoisted(() => ({
  handleUnauthorized: vi.fn(),
  listProjects: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("@kaneo/libs", () => ({
  client: {
    "gitlab-integration": {
      projects: { $post: listProjects },
      verify: { $post: verify },
    },
  },
}));
vi.mock("@sentry/react", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/http-error", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/http-error")>()),
  handleUnauthorized,
}));

const credentials = {
  projectId: "project-1",
  baseUrl: "https://gitlab.example.com",
  accessToken: "glpat-rejected",
};

const gitlabRejected = () =>
  Response.json(
    {
      message: "Invalid GitLab token or unauthorized.",
      code: "INTEGRATION_AUTH_FAILED",
    },
    { status: 401 },
  );

const sessionRejected = () =>
  Response.json(
    { message: "Unauthorized", code: "UNAUTHORIZED" },
    { status: 401 },
  );

beforeEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
});

describe("global unauthorized handling", () => {
  it("keeps the Kaneo session when GitLab rejects a token while listing projects", async () => {
    listProjects.mockResolvedValue(gitlabRejected());

    await expect(
      queryClient.fetchQuery({
        queryKey: ["gitlab-projects"],
        queryFn: () => listGitlabProjects(credentials),
        retry: false,
      }),
    ).rejects.toMatchObject({
      status: 401,
      code: "INTEGRATION_AUTH_FAILED",
      message: "Invalid GitLab token or unauthorized.",
    });
    expect(handleUnauthorized).not.toHaveBeenCalled();
  });

  it("keeps the Kaneo session when GitLab rejects a token during verification", async () => {
    verify.mockResolvedValue(gitlabRejected());

    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () =>
        verifyGitlabAccess({ ...credentials, projectPath: "acme/web" }),
    });

    await expect(mutation.execute(undefined)).rejects.toMatchObject({
      status: 401,
      code: "INTEGRATION_AUTH_FAILED",
    });
    expect(handleUnauthorized).not.toHaveBeenCalled();
  });

  it("signs out when Kaneo rejects the session", async () => {
    listProjects.mockResolvedValue(sessionRejected());

    await expect(
      queryClient.fetchQuery({
        queryKey: ["gitlab-projects"],
        queryFn: () => listGitlabProjects(credentials),
      }),
    ).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(handleUnauthorized).toHaveBeenCalledTimes(1);
  });
});
