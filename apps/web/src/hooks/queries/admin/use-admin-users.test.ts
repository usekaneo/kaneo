import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { getAdminUsers } from "@/fetchers/admin/get-admin-users";
import { authClient } from "@/lib/auth-client";

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

    await expect(getAdminUsers("", 1)).resolves.toEqual({
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

    await expect(getAdminUsers("  a  ", 0)).resolves.toEqual({
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

  it("paginates complete search results beyond the first API batch", async () => {
    const firstBatch = Array.from({ length: 100 }, (_, index) => ({
      ...ada,
      id: `user-${index}`,
      email: `user-${index}@example.com`,
    }));
    const finalUser = {
      ...ada,
      id: "user-100",
      email: "user-100@example.com",
    };

    listUsers
      .mockResolvedValueOnce({
        data: { users: firstBatch, total: 101 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { users: [], total: 0 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { users: [finalUser], total: 101 },
        error: null,
      });

    await expect(getAdminUsers("user", 5)).resolves.toEqual({
      users: [finalUser],
      total: 101,
    });
    expect(listUsers).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        query: expect.objectContaining({
          searchField: "name",
          limit: 100,
          offset: 100,
        }),
      }),
    );
  });
});
