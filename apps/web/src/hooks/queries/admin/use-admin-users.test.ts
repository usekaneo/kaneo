import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { fetchAdminUsers } from "./use-admin-users";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    admin: {
      listUsers: vi.fn(),
    },
  },
}));

const listUsers = authClient.admin.listUsers as Mock;

const ada = {
  id: "ada",
  name: "Ada Lovelace",
  email: "ada@example.com",
  emailVerified: true,
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  role: "admin",
  banned: false,
};

const grace = {
  id: "grace",
  name: "Grace Hopper",
  email: "grace@example.com",
  emailVerified: true,
  createdAt: new Date("2026-02-02T00:00:00.000Z"),
  updatedAt: new Date("2026-02-02T00:00:00.000Z"),
  role: "user",
  banned: false,
};

describe("fetchAdminUsers", () => {
  beforeEach(() => {
    listUsers.mockReset();
  });

  it("loads a paginated page in newest-first order", async () => {
    listUsers.mockResolvedValue({
      data: { users: [grace], total: 41 },
      error: null,
    });

    await expect(fetchAdminUsers("", 1)).resolves.toEqual({
      users: [grace],
      total: 41,
    });
    expect(listUsers).toHaveBeenCalledWith({
      query: {
        limit: 20,
        offset: 20,
        sortBy: "createdAt",
        sortDirection: "desc",
      },
    });
  });

  it("searches names and emails, then removes duplicate users", async () => {
    listUsers
      .mockResolvedValueOnce({
        data: { users: [ada, grace], total: 2 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { users: [ada], total: 1 },
        error: null,
      });

    await expect(fetchAdminUsers("  a  ", 0)).resolves.toEqual({
      users: [grace, ada],
      total: 2,
    });
    expect(listUsers).toHaveBeenNthCalledWith(1, {
      query: expect.objectContaining({
        searchValue: "a",
        searchField: "name",
      }),
    });
    expect(listUsers).toHaveBeenNthCalledWith(2, {
      query: expect.objectContaining({
        searchValue: "a",
        searchField: "email",
      }),
    });
  });
});
