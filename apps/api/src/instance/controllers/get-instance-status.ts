import { count, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { hasRegisteredUsers } from "../../utils/instance-bootstrap";

export type InstanceStatus = {
  hasUsers: boolean;
  hasAdmin: boolean;
};

async function getInstanceStatus(): Promise<InstanceStatus> {
  const hasUsers = await hasRegisteredUsers();
  const [adminRow] = await db
    .select({ value: count() })
    .from(schema.userTable)
    .where(eq(schema.userTable.role, "admin"));

  return {
    hasUsers,
    hasAdmin: (adminRow?.value ?? 0) > 0,
  };
}

export default getInstanceStatus;
