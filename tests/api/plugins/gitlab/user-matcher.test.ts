import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  getUser: vi.fn(),
  findUserByUsername: vi.fn(),
}));

vi.mock("../../../../apps/api/src/database", () => ({
  default: {
    query: {
      userTable: {
        findFirst: (...a: unknown[]) => mocks.userFindFirst(...a),
      },
    },
  },
}));

const { findKaneoUserByEmail, resolveGitlabAssigneeEmail } = await import(
  "../../../../apps/api/src/plugins/gitlab/utils/user-matcher"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("user-matcher", () => {
  it("finds Kaneo user by exact email or email prefix", async () => {
    mocks.userFindFirst.mockResolvedValueOnce({
      id: "user-1",
      name: "IO Tech Agent",
      email: "iotech.agent@gmail.com",
    });

    const user = await findKaneoUserByEmail("iotech.agent@gmail.com");
    expect(user?.id).toBe("user-1");
  });

  it("resolves gitlab assignee email from email or username fallback", async () => {
    const mockClient = {
      getUser: mocks.getUser,
      findUserByUsername: mocks.findUserByUsername,
    } as unknown as Parameters<typeof resolveGitlabAssigneeEmail>[0];

    const email1 = await resolveGitlabAssigneeEmail(mockClient, {
      id: 1,
      username: "iotech.agent",
      email: "iotech.agent@gmail.com",
    });
    expect(email1).toBe("iotech.agent@gmail.com");

    mocks.findUserByUsername.mockResolvedValueOnce(null);
    const usernameFallback = await resolveGitlabAssigneeEmail(mockClient, {
      id: 2,
      username: "iotech.agent",
    });
    expect(usernameFallback).toBe("iotech.agent");
  });
});
