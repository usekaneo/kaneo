import { config } from "dotenv-mono";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  accountTableRelations,
  activityTableRelations,
  apikeyTableRelations,
  githubIntegrationTableRelations,
  invitationTableRelations,
  labelTableRelations,
  notificationTableRelations,
  projectTableRelations,
  sessionTableRelations,
  taskTableRelations,
  teamMemberTableRelations,
  teamTableRelations,
  timeEntryTableRelations,
  userTableRelations,
  verificationTableRelations,
  workspaceTableRelations,
  workspaceUserTableRelations,
} from "./relations";
import {
  accountTable,
  activityTable,
  apikeyTable,
  githubIntegrationTable,
  invitationTable,
  labelTable,
  notificationTable,
  projectTable,
  sessionTable,
  taskTable,
  teamMemberTable,
  teamTable,
  timeEntryTable,
  userTable,
  verificationTable,
  workspaceTable,
  workspaceUserTable,
} from "./schema";

config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://kaneo_user:kaneo_password@localhost:5432/kaneo",
});

export const schema = {
  accountTable,
  activityTable,
  githubIntegrationTable,
  labelTable,
  notificationTable,
  projectTable,
  sessionTable,
  taskTable,
  timeEntryTable,
  userTable,
  verificationTable,
  workspaceTable,
  workspaceUserTable,
  invitationTable,
  teamTable,
  teamMemberTable,
  userTableRelations,
  sessionTableRelations,
  accountTableRelations,
  verificationTableRelations,
  workspaceTableRelations,
  workspaceUserTableRelations,
  teamTableRelations,
  teamMemberTableRelations,
  projectTableRelations,
  taskTableRelations,
  timeEntryTableRelations,
  activityTableRelations,
  labelTableRelations,
  notificationTableRelations,
  githubIntegrationTableRelations,
  invitationTableRelations,
  apikeyTable,
  apikeyTableRelations,
};

const db = drizzle(pool, {
  schema: schema,
});

export default db;
