import bcrypt from "bcrypt";
import { HTTPException } from "hono/http-exception";
import db from "../../database";

async function signIn(email: string, password: string) {
  const user = await db.query.userTable.findFirst({
    where: (users, { eq }) => eq(users.email, email),
  });

  if (!user) {
    throw new HTTPException(404, {
      message: "User not found",
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new HTTPException(401, {
      message: "Invalid credentials",
    });
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

export default signIn;
