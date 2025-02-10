import type { Static } from 'elysia';
import db from '../../database';
import { userTable } from '../../database/schema';
import type { signUpUserSchema } from '../db/queries';
import { UserErrors } from '../errors';

type SignUpArgs = Static<typeof signUpUserSchema>;

async function signUp({ email, name, password }: SignUpArgs) {
  const isEmailTaken = Boolean(
    await db.query.userTable.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    }),
  );

  if (isEmailTaken) {
    throw new Error(UserErrors.EmailTaken);
  }

  const hashedPassword = await Bun.password.hash(password, {
    algorithm: 'bcrypt',
  });

  const user = (
    await db
      .insert(userTable)
      .values({ email, name, password: hashedPassword })
      .returning()
  ).at(0);

  return user;
}

export default signUp;
