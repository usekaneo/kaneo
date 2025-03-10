import db from "../../database";
import { UserErrors } from "../errors";

async function signIn(email: string, password: string) {
  const user = await db.query.userTable.findFirst({
    where: (users, { eq }) => eq(users.email, email),
  });

  if (!user) {
    throw new Error(UserErrors.NotFound);
  }

  const isPasswordValid = await Bun.password.verify(
    password,
    user.password,
    "bcrypt",
  );

  if (!isPasswordValid) {
    throw new Error(UserErrors.InvalidCredentials);
  }

  return user;
}

export default signIn;
