import Elysia, { t } from 'elysia';
import createWorkspace from './controllers/create-workspace';
import deleteWorkspace from './controllers/delete-workspace';
import getWorkspace from './controllers/get-workspace';
import getWorkspaces from './controllers/get-workspaces';
import updateWorkspace from './controllers/update-workspace';
import { updateWorkspaceSchema } from './db/queries';

const workspace = new Elysia({ prefix: '/workspace' })
  .state('userEmail', '')
  .post(
    '/create',
    async ({ body, store }) => {
      const userEmail = store.userEmail;

      const createdWorkspace = await createWorkspace({
        ...body,
        ownerEmail: userEmail,
      });

      return createdWorkspace;
    },
    {
      body: t.Object({
        name: t.String(),
      }),
    },
  )
  .get('/list', async ({ store }) => {
    const userEmail = store.userEmail;

    const workspaces = await getWorkspaces({ userEmail });

    return workspaces;
  })
  .get('/:id', async ({ store, params }) => {
    const userEmail = store.userEmail;
    const workspaceId = params.id;

    const acquiredWorkspace = await getWorkspace({ userEmail, workspaceId });

    return acquiredWorkspace;
  })
  .put(
    '/:id',
    async ({ store, params, body }) => {
      const userEmail = store.userEmail;
      const workspaceId = params.id;

      const updatedWorkspace = await updateWorkspace({
        userEmail,
        workspaceId,
        body,
      });

      return updatedWorkspace;
    },
    { body: updateWorkspaceSchema },
  )
  .delete('/:id', async ({ store, params }) => {
    const userEmail = store.userEmail;
    const workspaceId = params.id;

    const deletedWorkspace = await deleteWorkspace({ userEmail, workspaceId });

    return deletedWorkspace;
  });

export default workspace;
