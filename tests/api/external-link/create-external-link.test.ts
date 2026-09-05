import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockPublishEvent = vi.fn();

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("../../../apps/api/src/events", () => ({
  publishEvent: (...args: unknown[]) => mockPublishEvent(...args),
}));

import createExternalLink from "../../../apps/api/src/external-link/controllers/create-external-link";

describe("createExternalLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([
              {
                projectId: "project-1",
                title: "Test task",
                status: "todo",
              },
            ]),
          }),
        }),
      }),
    });
  });

  it("creates an external link and publishes a task update event", async () => {
    const createdLink = {
      id: "link-1",
      taskId: "task-1",
      integrationId: null,
      resourceType: "url",
      externalId: "https://example.com",
      url: "https://example.com",
      title: "Example",
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const returning = vi.fn().mockResolvedValue([createdLink]);
    const values = vi.fn().mockReturnValue({ returning });

    mockInsert.mockReturnValue({ values });

    const result = await createExternalLink({
      taskId: "task-1",
      url: "https://example.com",
      title: "Example",
      userId: "user-1",
    });

    expect(values).toHaveBeenCalledWith({
      taskId: "task-1",
      integrationId: null,
      resourceType: "url",
      externalId: "https://example.com",
      url: "https://example.com",
      title: "Example",
    });

    expect(returning).toHaveBeenCalled();
    expect(result).toEqual(createdLink);

    expect(mockPublishEvent).toHaveBeenCalledWith("task.updated", {
      taskId: "task-1",
      projectId: "project-1",
      title: "Test task",
      status: "todo",
      userId: "user-1",
    });
  });

  it("stores null when title is omitted", async () => {
    const createdLink = {
      id: "link-2",
      taskId: "task-1",
      integrationId: null,
      resourceType: "url",
      externalId: "https://example.com",
      url: "https://example.com",
      title: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const returning = vi.fn().mockResolvedValue([createdLink]);
    const values = vi.fn().mockReturnValue({ returning });

    mockInsert.mockReturnValue({ values });

    await createExternalLink({
      taskId: "task-1",
      url: "https://example.com",
      userId: "user-1",
    });

    expect(values).toHaveBeenCalledWith({
      taskId: "task-1",
      integrationId: null,
      resourceType: "url",
      externalId: "https://example.com",
      url: "https://example.com",
      title: null,
    });
  });

  it("throws when the database does not return a created link", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const values = vi.fn().mockReturnValue({ returning });

    mockInsert.mockReturnValue({ values });

    await expect(
      createExternalLink({
        taskId: "task-1",
        url: "https://example.com",
        userId: "user-1",
      }),
    ).rejects.toMatchObject({
      status: 500,
    });

    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});
