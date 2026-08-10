import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGiteaFetch } = vi.hoisted(() => ({
  mockGiteaFetch: vi.fn(),
}));

// Stub GiteaApiError locally; the controller branches on `instanceof` + `.kind`.
type GiteaApiErrorKind =
  | "REDIRECT"
  | "INVALID_JSON"
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "EMPTY_RESPONSE";

class GiteaApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public kind: GiteaApiErrorKind,
    public body?: string,
  ) {
    super(message);
    this.name = "GiteaApiError";
  }
}

vi.mock("../../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  GiteaApiError,
  giteaFetch: (...args: unknown[]) => mockGiteaFetch(...args),
  createGiteaClient: () => ({
    getRepo: (...args: unknown[]) => mockGiteaFetch(...args),
  }),
  verifyGiteaToken: (...args: unknown[]) => mockGiteaFetch(...args),
}));

const { default: verifyGiteaAccess } = await import(
  "../../../apps/api/src/gitea-integration/controllers/verify-gitea-access"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyGiteaAccess", () => {
  it("returns success when the token can access the repository", async () => {
    mockGiteaFetch
      .mockResolvedValueOnce({ id: 1, login: "owner" })
      .mockResolvedValueOnce({
        name: "repo",
        owner: { login: "owner" },
        html_url: "https://gitea.example/owner/repo",
        private: false,
        permissions: { admin: true, push: true, pull: true },
      });

    const result = await verifyGiteaAccess({
      baseUrl: "https://gitea.example",
      accessToken: "token",
      repositoryOwner: "owner",
      repositoryName: "repo",
    });

    expect(result).toMatchObject({
      isInstalled: true,
      hasRequiredPermissions: true,
      repositoryExists: true,
      repositoryPrivate: false,
      missingPermissions: [],
      message: "Token can access the repository.",
      failureReason: null,
    });
  });

  it("returns a redirect-specific message when the URL redirects (e.g. http → https)", async () => {
    mockGiteaFetch.mockRejectedValue(
      new GiteaApiError(
        "Gitea request was redirected (HTTP 308)",
        308,
        "REDIRECT",
      ),
    );

    const result = await verifyGiteaAccess({
      baseUrl: "http://gitea.example",
      accessToken: "token",
      repositoryOwner: "owner",
      repositoryName: "repo",
    });

    expect(result.isInstalled).toBe(false);
    expect(result.repositoryExists).toBe(false);
    expect(result.failureReason).toBe("redirected");
    expect(result.message).toContain("redirected");
    expect(result.message).toContain("HTTP 308");
    expect(result.message).not.toContain("does not point to a Gitea instance.");
  });

  it("returns a redirect-specific message when getRepo redirects after the token check succeeds", async () => {
    mockGiteaFetch
      .mockResolvedValueOnce({ id: 1, login: "owner" })
      .mockRejectedValueOnce(
        new GiteaApiError(
          "Gitea request was redirected (HTTP 301)",
          301,
          "REDIRECT",
        ),
      );

    const result = await verifyGiteaAccess({
      baseUrl: "http://gitea.example",
      accessToken: "token",
      repositoryOwner: "owner",
      repositoryName: "repo",
    });

    expect(result.isInstalled).toBe(false);
    expect(result.failureReason).toBe("redirected");
    expect(result.message).toContain("HTTP 301");
  });

  it("returns 'not a Gitea instance' when the response is invalid JSON", async () => {
    mockGiteaFetch.mockRejectedValue(
      new GiteaApiError("Gitea API returned invalid JSON", 200, "INVALID_JSON"),
    );

    const result = await verifyGiteaAccess({
      baseUrl: "https://not-gitea.example",
      accessToken: "token",
      repositoryOwner: "owner",
      repositoryName: "repo",
    });

    expect(result.isInstalled).toBe(false);
    expect(result.failureReason).toBe("not_a_gitea_instance");
    expect(result.message).toBe("The URL does not point to a Gitea instance.");
  });

  it("does not branch on the message string — INVALID_JSON must use the kind discriminator", async () => {
    // Same status and message as the redirect case, but with INVALID_JSON kind.
    // The controller must dispatch on kind, not message substring matching.
    mockGiteaFetch.mockRejectedValue(
      new GiteaApiError("Gitea request was redirected", 308, "INVALID_JSON"),
    );

    const result = await verifyGiteaAccess({
      baseUrl: "http://gitea.example",
      accessToken: "token",
      repositoryOwner: "owner",
      repositoryName: "repo",
    });

    expect(result.failureReason).toBe("not_a_gitea_instance");
    expect(result.message).toBe("The URL does not point to a Gitea instance.");
  });
});
