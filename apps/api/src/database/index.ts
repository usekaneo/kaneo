import { config } from "dotenv-mono";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  accountTableRelations,
  activityTableRelations,
  apikeyTableRelations,
  columnTableRelations,
  externalLinkTableRelations,
  githubIntegrationTableRelations,
  integrationTableRelations,
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
  workflowRuleTableRelations,
  workspaceTableRelations,
  workspaceUserTableRelations,
} from "./relations";
import {
  accountTable,
  activityTable,
  apikeyTable,
  columnTable,
  externalLinkTable,
  githubIntegrationTable,
  integrationTable,
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
  workflowRuleTable,
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
  apikeyTable,
  columnTable,
  externalLinkTable,
  githubIntegrationTable,
  integrationTable,
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
  workflowRuleTable,
  workspaceTable,
  workspaceUserTable,
  accountTableRelations,
  activityTableRelations,
  apikeyTableRelations,
  columnTableRelations,
  externalLinkTableRelations,
  githubIntegrationTableRelations,
  integrationTableRelations,
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
  workflowRuleTableRelations,
  workspaceTableRelations,
  workspaceUserTableRelations,
};

const db = drizzle(pool, {
  schema: schema,
});

export default db;
