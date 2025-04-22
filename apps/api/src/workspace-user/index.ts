import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { subscribeToEvent } from "../events";
import createRootWorkspaceUser from "./controllers/create-root-workspace-user";
import deleteWorkspaceUser from "./controllers/delete-workspace-user";
import getActiveWorkspaceUsers from "./controllers/get-active-workspace-users";
import getWorkspaceUser from "./controllers/get-workspace-user";
import getWorkspaceUsers from "./controllers/get-workspace-users";
import inviteWorkspaceUser from "./controllers/invite-workspace-user";
import updateWorkspaceUser from "./controllers/update-workspace-user";

const workspaceUser = new Hono<{
  Variables: {
    userEmail: string;
  };
}>()
  .get("/:id", zValidator("param", z.object({ id: z.string() })), async (c) => {
    const { id } = c.req.valid("param");

    const workspaceUser = await getWorkspaceUser(id);

    return c.json(workspaceUser);
  })
  .post(
    "/root",
    zValidator(
      "json",
      z.object({
        workspaceId: z.string(),
        userEmail: z.string(),
      }),
    ),
    async (c) => {
      const { workspaceId, userEmail } = c.req.valid("json");

      const workspaceUser = await createRootWorkspaceUser(
        workspaceId,
        userEmail,
      );

      return c.json(workspaceUser);
    },
  )
  .get(
    "/:workspaceId",
    zValidator("param", z.object({ workspaceId: z.string() })),
    async (c) => {
      const { workspaceId } = c.req.valid("param");

      const workspaceUsers = await getWorkspaceUsers(workspaceId);

      return c.json(workspaceUsers);
    },
  )
  .delete(
    "/:workspaceId",
    zValidator("param", z.object({ workspaceId: z.string() })),
    zValidator("query", z.object({ userEmail: z.string() })),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      const { userEmail } = c.req.valid("query");

      const deletedWorkspaceUser = await deleteWorkspaceUser(
        workspaceId,
        userEmail,
      );

      return c.json(deletedWorkspaceUser);
    },
  )
  .put(
    "/:userEmail",
    zValidator("param", z.object({ userEmail: z.string() })),
    zValidator("json", z.object({ status: z.string() })),
    async (c) => {
      const { userEmail } = c.req.valid("param");
      const { status } = c.req.valid("json");

      const updatedWorkspaceUser = await updateWorkspaceUser(userEmail, status);

      return c.json(updatedWorkspaceUser);
    },
  )
  .get(
    "/:workspaceId/active",
    zValidator("param", z.object({ workspaceId: z.string() })),
    async (c) => {
      const { workspaceId } = c.req.valid("param");

      const activeWorkspaceUsers = await getActiveWorkspaceUsers(workspaceId);

      return c.json(activeWorkspaceUsers);
    },
  )
  .post(
    "/:workspaceId/invite",
    zValidator("param", z.object({ workspaceId: z.string() })),
    zValidator("json", z.object({ userEmail: z.string() })),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      const { userEmail } = c.req.valid("json");

      const workspaceUser = await inviteWorkspaceUser(workspaceId, userEmail);

      return c.json(workspaceUser);
    },
  )
  .delete(
    "/:workspaceId/invite/:userEmail",
    zValidator(
      "param",
      z.object({ workspaceId: z.string(), userEmail: z.string() }),
    ),
    async (c) => {
      const { workspaceId, userEmail } = c.req.valid("param");

      const deletedWorkspaceUser = await deleteWorkspaceUser(
        workspaceId,
        userEmail,
      );

      return c.json(deletedWorkspaceUser);
    },
  );

subscribeToEvent("user.signed_up", async ({ email }: { email: string }) => {
  if (!email) {
    return;
  }

  await updateWorkspaceUser(email, "active");
});

subscribeToEvent(
  "workspace.created",
  async ({
    workspaceId,
    ownerEmail,
  }: { workspaceId: string; ownerEmail: string }) => {
    if (!workspaceId || !ownerEmail) {
      return;
    }

    await createRootWorkspaceUser(workspaceId, ownerEmail);
  },
);

export default workspaceUser;
