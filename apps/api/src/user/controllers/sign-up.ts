import db from "../../database";
import { userTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { UserErrors } from "../errors";

async function signUp(email: string, password: string, name: string) {
  const isEmailTaken = Boolean(
    await db.query.userTable.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    }),
  );

  if (isEmailTaken) {
    throw new Error(UserErrors.EmailTaken);
  }

  const hashedPassword = await Bun.password.hash(password, {
    algorithm: "bcrypt",
  });

  const user = (
    await db
      .insert(userTable)
      .values({ email, name, password: hashedPassword })
      .returning()
  ).at(0);

  if (!user) {
    throw new Error(UserErrors.NotFound);
  }

  publishEvent("user.signed_up", {
    email: user.email,
  });

  return user;
}

export default signUp;
