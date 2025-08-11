import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  activityTableRelations,
  giteaIntegrationTableRelations,
  githubIntegrationTableRelations,
  labelTableRelations,
  notificationTableRelations,
  projectTableRelations,
  sessionTableRelations,
  taskTableRelations,
  timeEntryTableRelations,
  userTableRelations,
  workspaceTableRelations,
  workspaceUserTableRelations,
} from "./relations";
import * as schema from "./schema";

dotenv.config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://kaneo_user:kaneo_password@localhost:5432/kaneo",
});

const db = drizzle(pool, {
  schema: {
    ...schema,
    userTableRelations,
    sessionTableRelations,
    workspaceTableRelations,
    workspaceUserTableRelations,
    projectTableRelations,
    taskTableRelations,
    timeEntryTableRelations,
    activityTableRelations,
    labelTableRelations,
    notificationTableRelations,
    githubIntegrationTableRelations,
    giteaIntegrationTableRelations,
  },
});

export default db;
