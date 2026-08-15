import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { default: verifyGiteaAccess } = await import(
  "../../../apps/api/src/gitea-integration/controllers/verify-gitea-access"
);

// ponytail: capture the env var so we don't leak the SSRF bypass across tests.
const originalAllowPrivate =
  process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;

function makeResponse(status: number, body: string | object = ""): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  // Bypass the SSRF DNS check so the test does not depend on outbound DNS
  // resolving gitea.example. Without this, the real lookup would fail in CI.
  process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = "true";
});

afterEach(() => {
  if (originalAllowPrivate === undefined) {
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;
  } else {
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = originalAllowPrivate;
  }
  vi.unstubAllGlobals();
});

describe("verifyGiteaAccess — fetch integration", () => {
  it("returns success when the API returns a user and a writable repo", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(makeResponse(200, { id: 1, login: "owner" }))
      .mockResolvedValueOnce(
        makeResponse(200, {
          name: "repo",
          owner: { login: "owner" },
          html_url: "https://gitea.example/owner/repo",
          private: false,
          permissions: { admin: true, push: true, pull: true },
        }),
      );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await verifyGiteaAccess({
      baseUrl: "https://gitea.example",
      accessToken: "token",
      repositoryOwner: "owner",
      repositoryName: "repo",
    });

    expect(result).toEqual({
      isInstalled: true,
      hasRequiredPermissions: true,
      repositoryExists: true,
      repositoryPrivate: false,
      missingPermissions: [],
      message: "Token can access the repository.",
      failureReason: null,
    });
  });

  it("returns the 'not a Gitea instance' message when the response body is HTML, not JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeResponse(200, "<html>Not Gitea</html>"));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await verifyGiteaAccess({
      baseUrl: "https://gitea.example",
      accessToken: "token",
      repositoryOwner: "owner",
      repositoryName: "repo",
    });

    expect(result.isInstalled).toBe(false);
    expect(result.repositoryExists).toBe(false);
    expect(result.failureReason).toBe("not_a_gitea_instance");
    expect(result.message).toBe("The URL does not point to a Gitea instance.");
  });

  it("returns a redirect-specific message when the API responds with 308", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(308, ""));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await verifyGiteaAccess({
      baseUrl: "http://gitea.example",
      accessToken: "token",
      repositoryOwner: "owner",
      repositoryName: "repo",
    });

    expect(result.isInstalled).toBe(false);
    expect(result.failureReason).toBe("redirected");
    expect(result.message).toContain("redirected");
    expect(result.message).toContain("HTTP 308");
  });

  it("returns a redirect-specific message when the API responds with 301", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(301, ""));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await verifyGiteaAccess({
      baseUrl: "http://gitea.example",
      accessToken: "token",
      repositoryOwner: "owner",
      repositoryName: "repo",
    });

    expect(result.failureReason).toBe("redirected");
    expect(result.message).toContain("HTTP 301");
  });

  it("returns the repository-not-found message when getRepo responds with 404", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(makeResponse(200, { id: 1, login: "owner" }))
      .mockResolvedValueOnce(makeResponse(404, "Not Found"));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await verifyGiteaAccess({
      baseUrl: "https://gitea.example",
      accessToken: "token",
      repositoryOwner: "owner",
      repositoryName: "repo",
    });

    expect(result.isInstalled).toBe(false);
    expect(result.failureReason).toBe("repository_not_found");
    expect(result.message).toBe(
      "Repository not found or not accessible with this token.",
    );
  });

  it("returns the not-a-gitea-instance message when /user responds with 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(404, "Not Found"));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await verifyGiteaAccess({
      baseUrl: "https://gitea.example",
      accessToken: "token",
      repositoryOwner: "owner",
      repositoryName: "repo",
    });

    expect(result.isInstalled).toBe(false);
    expect(result.failureReason).toBe("not_a_gitea_instance");
    expect(result.message).toBe("The URL does not point to a Gitea instance.");
  });
});
