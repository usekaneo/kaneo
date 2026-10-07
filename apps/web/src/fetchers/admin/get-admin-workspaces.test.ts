import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { getAdminWorkspaces } from "./get-admin-workspaces";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@kaneo/libs", () => ({
  client: {
    admin: {
      workspaces: {
        $get: mocks.get,
      },
    },
  },
}));

const result = {
  workspaces: [
    {
      id: "acme",
      name: "Acme",
      slug: "acme",
      createdAt: "2026-01-02T00:00:00.000Z",
      memberCount: 3,
      projectCount: 2,
      owners: [{ id: "ada", name: "Ada Lovelace", email: "ada@example.com" }],
    },
  ],
  total: 41,
};

describe("getAdminWorkspaces", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.get.mockResolvedValue({
      ok: true,
      json: async () => result,
    });
  });

  it("requests the first page without a search parameter", async () => {
    await expect(getAdminWorkspaces("", 0)).resolves.toEqual(result);

    expect(mocks.get).toHaveBeenCalledWith({
      query: { page: "1", limit: "20" },
    });
  });

  it("passes the trimmed search through", async () => {
    await getAdminWorkspaces("  acme  ", 0);

    expect(mocks.get).toHaveBeenCalledWith({
      query: { search: "acme", page: "1", limit: "20" },
    });
  });

  it("caps the search at the API limit", async () => {
    await getAdminWorkspaces("a".repeat(250), 0);

    expect(mocks.get).toHaveBeenCalledWith({
      query: { search: "a".repeat(200), page: "1", limit: "20" },
    });
  });

  it("maps the zero-based page to the one-based API page", async () => {
    await getAdminWorkspaces("", 3);

    expect(mocks.get).toHaveBeenCalledWith({
      query: { page: "4", limit: "20" },
    });
  });

  it("throws an HttpError when the response is not ok", async () => {
    mocks.get.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });

    const error = await getAdminWorkspaces("", 0).catch((caught) => caught);

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(403);
    expect(error.message).toBe("Forbidden");
  });
});
