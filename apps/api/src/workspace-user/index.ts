import Elysia, { t } from 'elysia';
import getWorkspaceUsers from './controllers/get-workspace-users';
import inviteWorkspaceUser from './controllers/invite-workspace-user';

const workspaceUser = new Elysia({ prefix: '/workspace-user' })
  .get('/list/:workspaceId', async ({ params: { workspaceId } }) => {
    const workspaceUsersInWorkspace = await getWorkspaceUsers({ workspaceId });
    console.log({ workspaceUsersInWorkspace });

    return workspaceUsersInWorkspace;
  })
  .post(
    '/:workspaceId/invite',
    async ({ body }) => {
      const invitedWorkspaceUser = await inviteWorkspaceUser(body);

      return invitedWorkspaceUser;
    },
    {
      body: t.Object({
        userEmail: t.String(),
        workspaceId: t.String(),
      }),
    },
  );

export default workspaceUser;
