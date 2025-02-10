import type { Static } from 'elysia';
import db from '../../database';
import type { signInUserSchema } from '../db/queries';
import { UserErrors } from '../errors';

type SignInArgs = Static<typeof signInUserSchema>;

async function signIn({
  email,
  password,
}: Pick<SignInArgs, 'email' | 'password'>) {
  const user = await db.query.userTable.findFirst({
    where: (users, { eq }) => eq(users.email, email),
  });

  if (!user) {
    throw new Error(UserErrors.NotFound);
  }

  const isPasswordValid = await Bun.password.verify(
    password,
    user.password,
    'bcrypt',
  );

  if (!isPasswordValid) {
    throw new Error(UserErrors.InvalidCredentials);
  }

  return user;
}

export default signIn;
