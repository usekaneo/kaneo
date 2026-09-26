import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http-error";
import { getAdminUsers } from "./get-admin-users";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@kaneo/libs", () => ({
  client: {
    admin: {
      users: {
        $get: mocks.get,
      },
    },
  },
}));

const result = {
  users: [
    {
      id: "ada",
      name: "Ada Lovelace",
      email: "ada@example.com",
      emailVerified: true,
      image: null,
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      role: "admin",
      banned: false,
      banReason: null,
      banExpires: null,
    },
  ],
  total: 41,
};

describe("getAdminUsers", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.get.mockResolvedValue({
      ok: true,
      json: async () => result,
    });
  });

  it("requests the first page without a search parameter", async () => {
    await expect(getAdminUsers("", 0)).resolves.toEqual(result);

    expect(mocks.get).toHaveBeenCalledWith({
      query: { page: "1", limit: "20" },
    });
  });

  it("passes the trimmed search through", async () => {
    await getAdminUsers("  ada  ", 0);

    expect(mocks.get).toHaveBeenCalledWith({
      query: { search: "ada", page: "1", limit: "20" },
    });
  });

  it("maps the zero-based page to the one-based API page", async () => {
    await getAdminUsers("", 3);

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

    const error = await getAdminUsers("", 0).catch((caught) => caught);

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(403);
    expect(error.message).toBe("Forbidden");
  });
});
