import Elysia, { t } from 'elysia';
import createProject from './controllers/create-project';
import deleteProject from './controllers/delete-project';
import getProject from './controllers/get-project';
import getProjects from './controllers/get-projects';
import updateProject from './controllers/update-project';
import { updateProjectSchema } from './db/queries';

const project = new Elysia({ prefix: '/project' })
  .post(
    '/create',
    async ({ body }) => {
      const createdProject = await createProject(body);

      return createdProject;
    },
    {
      body: t.Object({
        name: t.String(),
        workspaceId: t.String(),
        icon: t.String(),
        slug: t.String(),
      }),
    },
  )
  .get('/list/:workspaceId', async ({ params: { workspaceId } }) => {
    const projects = await getProjects({ workspaceId });

    return projects;
  })
  .get('/:id', async ({ params: { id }, query: { workspaceId } }) => {
    if (!workspaceId) throw new Error('Workspace ID is required');

    const acquiredProject = await getProject({ id, workspaceId });

    return acquiredProject;
  })
  .put(
    '/:id',
    async ({ params: { id }, body: { workspaceId, name, description } }) => {
      const updatedProject = await updateProject({
        id,
        workspaceId,
        name,
        description,
      });

      return updatedProject;
    },
    {
      body: updateProjectSchema,
    },
  )
  .delete('/:id', async ({ params: { id }, query: { workspaceId } }) => {
    if (!workspaceId) throw new Error('Workspace ID is required');

    const deletedProject = await deleteProject({ id, workspaceId });

    return deletedProject;
  });

export default project;
