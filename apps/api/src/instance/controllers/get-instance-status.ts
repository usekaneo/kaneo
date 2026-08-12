import { count, desc, eq } from "drizzle-orm";
import db, { schema } from "../../database";

export type InstanceStatus = {
  hasUsers: boolean;
  hasAdmin: boolean;
  setupCompleted: boolean;
  appName: string;
};

async function getInstanceStatus(): Promise<InstanceStatus> {
  const [totalRow] = await db.select({ value: count() }).from(schema.userTable);
  const [adminRow] = await db
    .select({ value: count() })
    .from(schema.userTable)
    .where(eq(schema.userTable.role, "admin"));

  const [branding] = await db
    .select()
    .from(schema.instanceBrandingTable)
    .orderBy(desc(schema.instanceBrandingTable.createdAt))
    .limit(1);

  return {
    hasUsers: (totalRow?.value ?? 0) > 0,
    hasAdmin: (adminRow?.value ?? 0) > 0,
    setupCompleted: branding?.setupCompleted ?? false,
    appName: branding?.displayName ?? process.env.APP_NAME ?? "ElseTasks",
  };
}

export default getInstanceStatus;
