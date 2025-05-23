import { createId } from "@paralleldrive/cuid2";
import bcrypt from "bcrypt";
import db from "../database";
import { userTable } from "../database/schema";
import createSession from "../user/utils/create-session";
import generateSessionToken from "../user/utils/generate-session-token";
import { generateDemoName } from "./generate-demo-name";
export async function createDemoUser() {
  const demoId = createId();
  const demoName = generateDemoName();
  const demoEmail = `${demoName}-${demoId}@kaneo.app`;

  const hashedPassword = await bcrypt.hash("demo", 10);

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
