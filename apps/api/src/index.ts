import { logger } from '@bogeychan/elysia-logger';
import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';
import project from './project';
import task from './task';
import user from './user';
import { validateSessionToken } from './user/controllers/validate-session-token';
import workspace from './workspace';
import workspaceUser from './workspace-user';

const app = new Elysia()
  .state('userEmail', '')
  .use(cors())
  .use(logger())
  .use(user)
  .guard({
    async beforeHandle({ store, cookie: { session } }) {
      if (!session.value) {
        return { user: null };
      }

      const { user: sessionUser, session: validatedSession } =
        await validateSessionToken(session.value);

      if (!sessionUser || Boolean(validatedSession)) {
        return { user: null };
      }

      store.userEmail = sessionUser.email;
    },
  })
  .get('/me', async ({ cookie: { session } }) => {
    const { user: sessionUser } = await validateSessionToken(
      session.value ?? '',
    );

    if (sessionUser === null) {
      return { user: null };
    }

    return { sessionUser };
  })
  .use(workspace)
  .use(project)
  .use(task)
  .use(workspaceUser)
  .onError(({ code, error }) => {
    switch (code) {
      default:
        if (error instanceof Error) {
          return {
            name: error.name,
            message: error.message,
          };
        }
    }
  })
  .listen(1337);

export type App = typeof app;

console.log(`🏃 Kaneo is running at ${app.server?.url}`);
