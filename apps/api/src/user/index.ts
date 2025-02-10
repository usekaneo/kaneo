import { jwt } from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';
import createSession from './controllers/create-session';
import invalidateSession from './controllers/invalidate-session';
import signIn from './controllers/sign-in';
import signUp from './controllers/sign-up';
import { signInUserSchema, signUpUserSchema } from './db/queries';
import { UserErrors } from './errors';
import generateSessionToken from './utils/generate-session-token';

const user = new Elysia({ prefix: '/user' })
  .use(
    jwt({
      name: 'sessionToken',
      secret: process.env.JWT_ACCESS ?? '',
    }),
  )
  .post(
    '/sign-in',
    async ({ body, set }) => {
      const signedInUser = await signIn(body);

      const token = generateSessionToken();
      const session = await createSession(token, signedInUser.id);
      set.cookie = {
        session: {
          value: token,
          httpOnly: true,
          path: '/',
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          expires: session.expiresAt,
        },
      };

      return user;
    },
    {
      body: t.Omit(signInUserSchema, ['id', 'name', 'createdAt']),
    },
  )
  .post(
    '/sign-up',
    async ({ body, set }) => {
      const newUser = await signUp(body);

      if (!newUser) throw new Error(UserErrors.FailedToCreateAnAccount);

      const token = generateSessionToken();
      const session = await createSession(token, newUser.id);
      set.cookie = {
        session: {
          value: token,
          httpOnly: true,
          path: '/',
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          expires: session.expiresAt,
        },
      };

      return user;
    },
    {
      body: signUpUserSchema,
    },
  )
  .post('/sign-out', async ({ cookie, cookie: { session } }) => {
    await invalidateSession(session.value ?? '');
    session.remove();

    delete cookie.session;
  });

export default user;
