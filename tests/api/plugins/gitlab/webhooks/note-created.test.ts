import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleGitlabNoteCreated } from "../../../../../apps/api/src/plugins/gitlab/webhooks/note-created";

const mocks = vi.hoisted(() => {
  const insertedActivities: Array<Record<string, unknown>> = [];

  return {
    insertedActivities,
    findAllIntegrationsByGitlabProject: vi.fn(),
    findExternalLink: vi.fn(),
    db: {
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          insertedActivities.push(values);
          return { onConflictDoNothing: async () => undefined };
        },
      }),
    },
  };
});

vi.mock("../../../../../apps/api/src/database", () => ({ default: mocks.db }));

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    findExternalLink: (...args: unknown[]) => mocks.findExternalLink(...args),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/services/integration-lookup",
  () => ({
    findAllIntegrationsByGitlabProject: (...args: unknown[]) =>
      mocks.findAllIntegrationsByGitlabProject(...args),
  }),
);

function notePayload(
  overrides: {
    id?: number;
    internal?: boolean;
    system?: boolean;
    eventType?: string;
  } = {},
) {
  return {
    event_type: overrides.eventType ?? "note",
    user: { username: "octocat" },
    object_attributes: {
      id: overrides.id ?? 10,
      note: "Reproduced on Firefox too.",
      noteable_type: "Issue",
      url: "https://gitlab.com/acme/web/-/issues/3#note_10",
      system: overrides.system ?? false,
      internal: overrides.internal ?? false,
    },
    issue: { iid: 3 },
    project: {
      name: "web",
      web_url: "https://gitlab.com/acme/web",
      path_with_namespace: "acme/web",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insertedActivities.length = 0;
  mocks.findAllIntegrationsByGitlabProject.mockResolvedValue([
    { id: "integration-1" },
  ]);
  mocks.findExternalLink.mockResolvedValue({
    id: "link-1",
    taskId: "task-1",
    metadata: JSON.stringify({ state: "opened" }),
  });
});

describe("handleGitlabNoteCreated", () => {
  it("copies a comment into the task activity", async () => {
    await handleGitlabNoteCreated(notePayload());

    expect(mocks.insertedActivities).toHaveLength(1);
    expect(mocks.insertedActivities[0]).toMatchObject({
      taskId: "task-1",
      externalSource: "gitlab",
      content: "Reproduced on Firefox too.",
    });
  });

  it("keeps an internal note out of the workspace", async () => {
    await handleGitlabNoteCreated(notePayload({ internal: true }));

    expect(mocks.insertedActivities).toHaveLength(0);
  });

  it("keeps a comment on a confidential issue out of the workspace", async () => {
    await handleGitlabNoteCreated(
      notePayload({ eventType: "confidential_note" }),
    );

    expect(mocks.insertedActivities).toHaveLength(0);
  });

  it("skips system notes", async () => {
    await handleGitlabNoteCreated(notePayload({ system: true }));

    expect(mocks.insertedActivities).toHaveLength(0);
  });

  it("skips a note Kaneo posted itself", async () => {
    mocks.findExternalLink.mockResolvedValue({
      id: "link-1",
      taskId: "task-1",
      metadata: JSON.stringify({ syncedNoteIds: [10] }),
    });

    await handleGitlabNoteCreated(notePayload({ id: 10 }));

    expect(mocks.insertedActivities).toHaveLength(0);
  });
});
