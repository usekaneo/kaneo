import { createId } from "@paralleldrive/cuid2";
import db from "../database";
import { userTable } from "../database/schema";
import createSession from "../user/controllers/create-session";
import generateSessionToken from "../user/utils/generate-session-token";
import { generateDemoName } from "./generate-demo-name";

export async function createDemoUser() {
  const demoId = createId();
  const demoName = generateDemoName();
  const demoEmail = `${demoName}@kaneo.app`;

  const hashedPassword = await Bun.password.hash("demo", {
    algorithm: "bcrypt",
  });
  await db.insert(userTable).values({
    id: demoId,
    name: demoName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
    email: demoEmail,
    password: hashedPassword,
  });

  const token = generateSessionToken();
  const demoSession = await createSession(token, demoId);

  return {
    id: demoId,
    name: demoName,
    email: demoEmail,
    session: token,
    expiresAt: demoSession.expiresAt,
  };
}
