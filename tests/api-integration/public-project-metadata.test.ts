import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { withLastSync } from "../../apps/api/src/plugins/gitlab/utils/link-sync";
import getTasks from "../../apps/api/src/task/controllers/get-tasks";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

describe("public project link metadata", () => {
  it("redacts internal metadata in all task buckets and related pages", async () => {
    const member = await createWorkspaceMember();
    const outsider = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await db
      .update(schema.projectTable)
      .set({ isPublic: true })
      .where(eq(schema.projectTable.id, project.id));
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({ projectId: project.id, type: "gitlab", config: "{}" })
      .returning();
    const metadata = withLastSync(
      withLastSync(
        {
          state: "closed",
          merged: true,
          draft: false,
          internal: "internal-sentinel",
        },
        "title",
        "kaneo",
        "historical-title-sentinel",
      ),
      "description",
      "gitlab",
      "historical-description-sentinel",
    );
    const tasks = await db
      .insert(schema.taskTable)
      .values(
        ["to-do", "planned", "archived"].map((status, index) => ({
          projectId: project.id,
          number: index + 1,
          title: `Current ${status}`,
          description: "Current description",
          status,
        })),
      )
      .returning();
    await db.insert(schema.externalLinkTable).values(
      tasks.flatMap((task) =>
        Array.from({ length: 34 }, (_, index) => ({
          id: `${task.status}-${String(index).padStart(3, "0")}`,
          taskId: task.id,
          integrationId: integration.id,
          resourceType: "pull_request",
          externalId: `${task.number}-${index}`,
          url: `https://example.com/pull/${task.number}-${index}`,
          title: "Linked pull request",
          metadata: JSON.stringify(metadata),
        })),
      ),
    );
    const { app } = createApp();
    for (const signedIn of [false, true]) {
      if (signedIn) mockAuthenticatedSession(outsider.user);
      else mockAnonymousSession();
      const seen = new Set<string>();
      for (const relatedPage of [1, 2]) {
        const response = await app.request(
          `/api/public-project/${project.id}?relatedPage=${relatedPage}`,
        );
        expect(response.status).toBe(200);
        const text = await response.text();
        for (const sentinel of [
          "historical-title-sentinel",
          "historical-description-sentinel",
          "internal-sentinel",
          "lastSync",
        ]) {
          expect(text).not.toContain(sentinel);
        }
        const board = JSON.parse(text);
        const publicTasks = [
          ...board.columns.flatMap(
            (column: { tasks: unknown[] }) => column.tasks,
          ),
          ...board.plannedTasks,
          ...board.archivedTasks,
        ];
        expect(publicTasks).toHaveLength(3);
        for (const task of publicTasks) {
          expect(task.title).toContain("Current");
          expect(task.description).toBe("Current description");
          for (const link of task.externalLinks) {
            expect(link.metadata).toEqual({
              state: "closed",
              merged: true,
              draft: false,
            });
            expect(link.integrationId).toBeNull();
            expect(link.title).toBe("Linked pull request");
            seen.add(link.id);
          }
        }
      }
      expect(seen.size).toBe(102);
    }
    const authenticated = await getTasks(project.id, {}, member.user.id);
    expect(
      authenticated.data.columns.flatMap((column) => column.tasks)[0]
        .externalLinks[0].metadata,
    ).toEqual(metadata);
  });
});
