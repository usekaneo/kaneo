import bcrypt from "bcrypt";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { userTable } from "../../database/schema";
import { publishEvent } from "../../events";
import getSettings from "../../utils/get-settings";

async function signUp(email: string, password: string, name: string) {
  const { allowRegistration, isDemoMode } = getSettings();

  if (!allowRegistration && !isDemoMode) {
    throw new HTTPException(400, {
      message: "Registration is disabled on this instance",
    });
  }

  const isEmailTaken = Boolean(
    await db.query.userTable.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    }),
  );

  if (isEmailTaken) {
    throw new HTTPException(400, {
      message: "Email taken",
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = (
    await db
      .insert(userTable)
      .values({ email, name, password: hashedPassword })
      .returning()
  ).at(0);

  if (!user) {
    throw new HTTPException(500, {
      message: "Failed to create an account",
    });
  }

  publishEvent("user.signed_up", {
    email: user.email,
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

export default signUp;
