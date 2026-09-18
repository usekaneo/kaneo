import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  customType,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const userTable = pgTable("user", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  locale: text("locale"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  isAnonymous: boolean("is_anonymous").default(false),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { mode: "date" }),
});

export const sessionTable = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
    activeTeamId: text("active_team_id"),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const accountTable = pgTable(
  "account",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      mode: "date",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const userAvatarTable = pgTable(
  "user_avatar",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique("user_avatar_user_id_unique")
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("user_avatar_userId_idx").on(table.userId)],
);

export const verificationTable = pgTable(
  "verification",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const workspaceTable = pgTable("workspace", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

export const workspaceUserTable = pgTable(
  "workspace_member",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
      }),
    role: text("role").default("member").notNull(),
    joinedAt: timestamp("joined_at", { mode: "date" }).notNull(),
  },
  (table) => [
    index("workspace_member_workspaceId_idx").on(table.workspaceId),
    index("workspace_member_userId_idx").on(table.userId),
  ],
);

export const workspaceBillingTable = pgTable(
  "workspace_billing",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .unique("workspace_billing_workspace_id_unique")
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    foundingFree: boolean("founding_free").notNull().default(false),
    trialEndsAt: timestamp("trial_ends_at", { mode: "date" }),
    creemCustomerId: text("creem_customer_id"),
    creemSubscriptionId: text("creem_subscription_id").unique(),
    creemProductId: text("creem_product_id"),
    plan: text("plan"),
    billingInterval: text("billing_interval"),
    status: text("status"),
    seats: integer("seats").notNull().default(1),
    currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
    canceledAt: timestamp("canceled_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("workspace_billing_workspaceId_idx").on(table.workspaceId)],
);

export const trialGrantTable = pgTable("trial_grant", {
  emailHash: text("email_hash").primaryKey(),
  trialEndsAt: timestamp("trial_ends_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const billingEventTable = pgTable("billing_event", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at", { mode: "date" })
    .defaultNow()
    .notNull(),
});

export const teamTable = pgTable(
  "team",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").$onUpdate(
      () => /* @__PURE__ */ new Date(),
    ),
  },
  (table) => [index("team_workspaceId_idx").on(table.workspaceId)],
);

export const teamMemberTable = pgTable(
  "team_member",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teamTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    index("teamMember_teamId_idx").on(table.teamId),
    index("teamMember_userId_idx").on(table.userId),
  ],
);

export const invitationTable = pgTable(
  "invitation",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    teamId: text("team_id"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitation_workspaceId_idx").on(table.workspaceId),
    index("invitation_email_idx").on(table.email),
    index("invitation_inviterId_idx").on(table.inviterId),
  ],
);

export const workspaceRoleTable = pgTable(
  "workspace_role",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    role: text("role").notNull(),
    permission: text("permission").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("workspace_role_workspaceId_idx").on(table.workspaceId),
    index("workspace_role_role_idx").on(table.role),
  ],
);

export const projectTable = pgTable(
  "project",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    slug: text("slug").notNull(),
    icon: text("icon").default("Layout"),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    isPublic: boolean("is_public").default(false),
    archivedAt: timestamp("archived_at", { mode: "date" }),
    lastTaskNumber: integer("last_task_number").notNull().default(0),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    unique("project_workspace_id_id_unique").on(table.workspaceId, table.id),
    index("project_workspaceId_position_idx").on(
      table.workspaceId,
      table.position,
    ),
  ],
);

export const columnTable = pgTable(
  "column",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    position: integer("position").notNull().default(0),
    icon: text("icon"),
    color: text("color"),
    isFinal: boolean("is_final").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("column_projectId_idx").on(table.projectId)],
);

export const workflowRuleTable = pgTable(
  "workflow_rule",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    integrationType: text("integration_type").notNull(),
    eventType: text("event_type").notNull(),
    columnId: text("column_id")
      .notNull()
      .references(() => columnTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("workflow_rule_projectId_idx").on(table.projectId),
    index("workflow_rule_columnId_idx").on(table.columnId),
  ],
);

export const taskTable = pgTable(
  "task",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    position: integer("position").default(0),
    number: integer("number").default(1),
    estimateMinutes: integer("estimate_minutes"),
    userId: text("assignee_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("to-do"),
    columnId: text("column_id").references(() => columnTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    priority: text("priority").default("low").notNull(),
    startDate: timestamp("start_date", { mode: "date" }),
    dueDate: timestamp("due_date", { mode: "date" }),
    // Set by a database trigger when the task enters a final column, cleared
    // when it leaves one, so every code path that moves tasks keeps it right.
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("task_projectId_idx").on(table.projectId),
    index("task_dueDate_idx").on(table.dueDate),
    index("task_assigneeId_idx").on(table.userId),
    index("task_columnId_idx").on(table.columnId),
    index("task_completed_at_idx").on(table.completedAt),
    unique("task_project_number_unique").on(table.projectId, table.number),
  ],
);

export const billingReminderSentTable = pgTable(
  "billing_reminder_sent",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    reminderType: text("reminder_type").notNull(),
    trialEndsAt: timestamp("trial_ends_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("billing_reminder_sent_workspaceId_idx").on(table.workspaceId),
    index("billing_reminder_sent_userId_idx").on(table.userId),
    unique("billing_reminder_sent_user_type_unique").on(
      table.userId,
      table.reminderType,
    ),
  ],
);

export const jobLeaseTable = pgTable("job_lease", {
  name: text("name").primaryKey(),
  owner: text("owner").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
});

export const taskReminderSentTable = pgTable(
  "task_reminder_sent",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    reminderType: text("reminder_type").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("task_reminder_sent_taskId_idx").on(table.taskId),
    unique("task_reminder_sent_task_type_unique").on(
      table.taskId,
      table.reminderType,
    ),
  ],
);

export const timeEntryTable = pgTable(
  "time_entry",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    description: text("description"),
    startTime: timestamp("start_time", { mode: "date" }).notNull(),
    endTime: timestamp("end_time", { mode: "date" }),
    duration: integer("duration").default(0),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("time_entry_taskId_idx").on(table.taskId),
    index("time_entry_userId_idx").on(table.userId),
    // Timesheets: one person's week, and everyone's week.
    index("time_entry_userId_startTime_idx").on(table.userId, table.startTime),
    index("time_entry_startTime_idx").on(table.startTime),
  ],
);

export const activityTable = pgTable(
  "activity",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    type: text("type").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    content: text("content"),
    eventData: jsonb("event_data"),
    externalUserName: text("external_user_name"),
    externalUserAvatar: text("external_user_avatar"),
    externalSource: text("external_source"),
    externalUrl: text("external_url"),
    // Comments only: the comment this one replies to (null once it's deleted).
    replyToId: text("reply_to_id").references(
      (): AnyPgColumn => activityTable.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    // Set when the author edits a comment; updated_at also moves on other writes.
    editedAt: timestamp("edited_at", { mode: "date" }),
  },
  (table) => [
    index("activity_task_id_idx").on(table.taskId),
    index("activity_userId_idx").on(table.userId),
    unique("activity_task_external_source_external_url_unique").on(
      table.taskId,
      table.externalSource,
      table.externalUrl,
    ),
  ],
);

export const assetTable = pgTable(
  "asset",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    taskId: text("task_id").references(() => taskTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    activityId: text("activity_id").references(() => activityTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    objectKey: text("object_key").notNull().unique(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    kind: text("kind").notNull().default("image"),
    surface: text("surface").notNull().default("description"),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("asset_workspaceId_idx").on(table.workspaceId),
    index("asset_projectId_idx").on(table.projectId),
    index("asset_taskId_idx").on(table.taskId),
    index("asset_activityId_idx").on(table.activityId),
    index("asset_createdBy_idx").on(table.createdBy),
  ],
);

export const labelTable = pgTable(
  "label",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    taskId: text("task_id").references(() => taskTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    workspaceId: text("workspace_id").references(() => workspaceTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  },
  (table) => [
    index("label_task_id_idx").on(table.taskId),
    index("label_workspace_id_idx").on(table.workspaceId),
    unique("label_task_name_unique").on(table.taskId, table.name),
    uniqueIndex("label_workspace_name_unique")
      .on(table.workspaceId, table.name)
      .where(sql`${table.taskId} is null`),
  ],
);

export const notificationTable = pgTable(
  "notification",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    title: text("title"),
    content: text("content"),
    type: text("type").notNull().default("info"),
    eventData: jsonb("event_data"),
    isRead: boolean("is_read").default(false),
    resourceId: text("resource_id"),
    resourceType: text("resource_type"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("notification_userId_idx").on(table.userId)],
);

export const userNotificationPreferenceTable = pgTable(
  "user_notification_preference",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    emailEnabled: boolean("email_enabled").default(false).notNull(),
    ntfyEnabled: boolean("ntfy_enabled").default(false).notNull(),
    ntfyServerUrl: text("ntfy_server_url"),
    ntfyTopic: text("ntfy_topic"),
    ntfyToken: text("ntfy_token"),
    gotifyEnabled: boolean("gotify_enabled").default(false).notNull(),
    gotifyServerUrl: text("gotify_server_url"),
    gotifyToken: text("gotify_token"),
    webhookEnabled: boolean("webhook_enabled").default(false).notNull(),
    webhookUrl: text("webhook_url"),
    webhookSecret: text("webhook_secret"),
    taskAssignmentEnabled: boolean("task_assignment_enabled")
      .default(true)
      .notNull(),
    taskCommentEnabled: boolean("task_comment_enabled").default(true).notNull(),
    taskStatusChangeEnabled: boolean("task_status_change_enabled")
      .default(true)
      .notNull(),
    dueDateReminderEnabled: boolean("due_date_reminder_enabled")
      .default(true)
      .notNull(),
    dueDateReminderLeadTimeMinutes: integer(
      "due_date_reminder_lead_time_minutes",
    )
      .default(1440)
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
);

export const userNotificationWorkspaceRuleTable = pgTable(
  "user_notification_workspace_rule",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    isActive: boolean("is_active").default(true).notNull(),
    emailEnabled: boolean("email_enabled").default(false).notNull(),
    ntfyEnabled: boolean("ntfy_enabled").default(false).notNull(),
    gotifyEnabled: boolean("gotify_enabled").default(false).notNull(),
    webhookEnabled: boolean("webhook_enabled").default(false).notNull(),
    projectMode: text("project_mode").default("all").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("user_notification_workspace_rule_userId_idx").on(table.userId),
    index("user_notification_workspace_rule_workspaceId_idx").on(
      table.workspaceId,
    ),
    unique("user_notification_workspace_rule_user_workspace_unique").on(
      table.userId,
      table.workspaceId,
    ),
    unique("user_notification_workspace_rule_workspace_id_id_unique").on(
      table.workspaceId,
      table.id,
    ),
  ],
);

export const userNotificationWorkspaceProjectTable = pgTable(
  "user_notification_workspace_project",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    workspaceRuleId: text("workspace_rule_id").notNull(),
    projectId: text("project_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.workspaceRuleId],
      foreignColumns: [
        userNotificationWorkspaceRuleTable.workspaceId,
        userNotificationWorkspaceRuleTable.id,
      ],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projectTable.workspaceId, projectTable.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    index("user_notification_workspace_project_ruleId_idx").on(
      table.workspaceRuleId,
    ),
    index("user_notification_workspace_project_projectId_idx").on(
      table.projectId,
    ),
    index("user_notification_workspace_project_workspaceId_projectId_idx").on(
      table.workspaceId,
      table.projectId,
    ),
    index("unwp_workspaceId_workspaceRuleId_idx").on(
      table.workspaceId,
      table.workspaceRuleId,
    ),
    unique("user_notification_workspace_project_rule_project_unique").on(
      table.workspaceRuleId,
      table.projectId,
    ),
  ],
);

export const githubIntegrationTable = pgTable("github_integration", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .unique(),
  repositoryOwner: text("repository_owner").notNull(),
  repositoryName: text("repository_name").notNull(),
  installationId: integer("installation_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const integrationTable = pgTable(
  "integration",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    type: text("type").notNull(),
    config: text("config").notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("integration_projectId_idx").on(table.projectId),
    index("integration_type_idx").on(table.type),
    unique("integration_project_type_unique").on(table.projectId, table.type),
  ],
);

export const externalLinkTable = pgTable(
  "external_link",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    integrationId: text("integration_id")
      .notNull()
      .references(() => integrationTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    resourceType: text("resource_type").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("external_link_taskId_idx").on(table.taskId),
    index("external_link_integrationId_idx").on(table.integrationId),
    index("external_link_externalId_idx").on(table.externalId),
    index("external_link_resourceType_idx").on(table.resourceType),
  ],
);

export const commentTable = pgTable(
  "comment",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("comment_task_idx").on(table.taskId),
    index("comment_user_idx").on(table.userId),
  ],
);

export const taskRelationTable = pgTable(
  "task_relation",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    sourceTaskId: text("source_task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    targetTaskId: text("target_task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    relationType: text("relation_type").notNull(),
    // Subtasks only: which of the parent's checklists the item sits in, and
    // its place there. Deleting a checklist deletes its items (the tasks).
    checklistId: text("checklist_id").references(
      () => taskChecklistTable.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("task_relation_source_idx").on(table.sourceTaskId),
    index("task_relation_target_idx").on(table.targetTaskId),
    index("task_relation_checklist_idx").on(table.checklistId),
  ],
);

// Named groups of subtasks on a task ("Design", "QA"…). A null title shows
// as the translated default name, "Checklist".
export const taskChecklistTable = pgTable(
  "task_checklist",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    title: text("title"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("task_checklist_task_idx").on(table.taskId)],
);

export const apikeyTable = pgTable(
  "apikey",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    configId: text("config_id").default("default").notNull(),
    name: text("name"),
    start: text("start"),
    referenceId: text("reference_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    prefix: text("prefix"),
    key: text("key").notNull(),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "cascade",
    }),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at", { mode: "date" }),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(86400000),
    rateLimitMax: integer("rate_limit_max").default(10),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [
    index("apikey_configId_idx").on(table.configId),
    index("apikey_key_idx").on(table.key),
    index("apikey_referenceId_idx").on(table.referenceId),
    index("apikey_userId_idx").on(table.userId),
  ],
);

export const deviceCodeTable = pgTable(
  "device_code",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    deviceCode: text("device_code").notNull(),
    userCode: text("user_code").notNull(),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    status: text("status").notNull(),
    lastPolledAt: timestamp("last_polled_at", { mode: "date" }),
    pollingInterval: integer("polling_interval"),
    clientId: text("client_id"),
    scope: text("scope"),
  },
  (table) => [
    uniqueIndex("device_code_device_code_uidx").on(table.deviceCode),
    uniqueIndex("device_code_user_code_uidx").on(table.userCode),
    index("device_code_user_id_idx").on(table.userId),
  ],
);

export const mcpOauthStateTable = pgTable(
  "mcp_oauth_state",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    kind: text("kind").notNull(),
    key: text("key").notNull(),
    payload: jsonb("payload").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("mcp_oauth_state_kind_key_uidx").on(table.kind, table.key),
    index("mcp_oauth_state_expiresAt_idx").on(table.expiresAt),
  ],
);

// Auth-schema compatible aliases in schema.ts
export const user = userTable;
export const session = sessionTable;
export const account = accountTable;
export const verification = verificationTable;
export const workspace = workspaceTable;
export const team = teamTable;
export const teamMember = teamMemberTable;
export const workspace_member = workspaceUserTable;
export const invitation = invitationTable;
export const organizationRole = workspaceRoleTable;
export const apikey = apikeyTable;
export const deviceCode = deviceCodeTable;

// Auth-schema compatible relation exports in schema.ts
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  teamMembers: many(teamMember),
  workspace_members: many(workspace_member),
  invitations: many(invitation),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const workspaceRelations = relations(workspace, ({ many }) => ({
  teams: many(team),
  workspace_members: many(workspace_member),
  invitations: many(invitation),
}));

export const teamRelations = relations(team, ({ one, many }) => ({
  workspace: one(workspace, {
    fields: [team.workspaceId],
    references: [workspace.id],
  }),
  teamMembers: many(teamMember),
}));

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
  team: one(team, {
    fields: [teamMember.teamId],
    references: [team.id],
  }),
  user: one(user, {
    fields: [teamMember.userId],
    references: [user.id],
  }),
}));

export const workspace_memberRelations = relations(
  workspace_member,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [workspace_member.workspaceId],
      references: [workspace.id],
    }),
    user: one(user, {
      fields: [workspace_member.userId],
      references: [user.id],
    }),
  }),
);

export const invitationRelations = relations(invitation, ({ one }) => ({
  workspace: one(workspace, {
    fields: [invitation.workspaceId],
    references: [workspace.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

export const organizationRoleRelations = relations(
  organizationRole,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [organizationRole.workspaceId],
      references: [workspace.id],
    }),
  }),
);

export const customFieldDefinitionTable = pgTable(
  "custom_field_definition",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    type: text("type").notNull(), // 'text' | 'number' | 'date' | 'dropdown' | 'boolean'
    required: boolean("required").default(false).notNull(),
    defaultValue: text("default_value"),
    options: jsonb("options"),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("custom_field_def_projectId_idx").on(table.projectId)],
);

export const customFieldValueTable = pgTable(
  "custom_field_value",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    fieldId: text("field_id")
      .notNull()
      .references(() => customFieldDefinitionTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    value: text("value"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("custom_field_value_taskId_idx").on(table.taskId),
    index("custom_field_value_fieldId_idx").on(table.fieldId),
    unique("custom_field_value_task_field_unique").on(
      table.taskId,
      table.fieldId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Company layer: people, attendance, desktop activity, pay, requests, audit.
// Money is stored as integer minor units (e.g. paisa) in the workspace
// currency. Calendar days are `date` strings (YYYY-MM-DD) in the workspace
// timezone; instants are timestamps.
// ---------------------------------------------------------------------------

export const companySettingsTable = pgTable("company_settings", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspaceTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  timezone: text("timezone").notNull().default("UTC"),
  currency: text("currency").notNull().default("USD"),
  // ISO weekdays, 1 = Monday … 7 = Sunday.
  workDays: text("work_days").notNull().default("1,2,3,4,5"),
  workStart: text("work_start").notNull().default("09:00"),
  workEnd: text("work_end").notNull().default("17:00"),
  breakMinutes: integer("break_minutes").notNull().default(60),
  // Clocking in up to this many minutes after the start still counts as on time.
  lateGraceMinutes: integer("late_grace_minutes").notNull().default(10),
  annualLeaveDays: integer("annual_leave_days").notNull().default(15),
  overtimeRatePercent: integer("overtime_rate_percent").notNull().default(100),
  trackDomains: boolean("track_domains").notNull().default(true),
  activityDetailDays: integer("activity_detail_days").notNull().default(90),
  activitySummaryDays: integer("activity_summary_days").notNull().default(365),
  // Clock people in and out from the desktop app's activity.
  autoClock: boolean("auto_clock").notNull().default(false),
  // Clock out after this long without keyboard or mouse activity…
  autoClockIdleMinutes: integer("auto_clock_idle_minutes")
    .notNull()
    .default(15),
  // …or this long without hearing from any of the person's devices.
  autoClockOfflineMinutes: integer("auto_clock_offline_minutes")
    .notNull()
    .default(10),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const departmentTable = pgTable(
  "department",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    unique("department_workspace_name_unique").on(
      table.workspaceId,
      table.name,
    ),
  ],
);

export const employeeProfileTable = pgTable(
  "employee_profile",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    title: text("title"),
    departmentId: text("department_id").references(() => departmentTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    joinDate: date("join_date", { mode: "string" }),
    status: text("status").notNull().default("active"),
    // Null means "use the company schedule".
    workDays: text("work_days"),
    workStart: text("work_start"),
    workEnd: text("work_end"),
    breakMinutes: integer("break_minutes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("employee_profile_workspace_user_unique").on(
      table.workspaceId,
      table.userId,
    ),
    index("employee_profile_departmentId_idx").on(table.departmentId),
  ],
);

export const attendanceSessionTable = pgTable(
  "attendance_session",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    clockIn: timestamp("clock_in", { mode: "date" }).notNull(),
    clockOut: timestamp("clock_out", { mode: "date" }),
    source: text("source").notNull().default("web"),
    // "agent" when the desktop app's inactivity closed it; anything else is a
    // person, whose clock-out keeps the app from clocking them back in that day.
    clockOutSource: text("clock_out_source"),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("attendance_session_user_clockIn_idx").on(
      table.workspaceId,
      table.userId,
      table.clockIn,
    ),
    // A person is clocked in at most once per workspace at a time.
    uniqueIndex("attendance_session_open_unique")
      .on(table.workspaceId, table.userId)
      .where(sql`${table.clockOut} is null`),
  ],
);

export const agentDeviceTable = pgTable(
  "agent_device",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    platform: text("platform").notNull(),
    agentVersion: text("agent_version"),
    // SHA-256 of the device token; the token itself is never stored.
    tokenHash: text("token_hash")
      .notNull()
      .unique("agent_device_token_hash_unique"),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }),
    lastState: text("last_state"),
    // Latest moment the device saw keyboard or mouse activity.
    lastActiveAt: timestamp("last_active_at", { mode: "date" }),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("agent_device_workspace_user_idx").on(
      table.workspaceId,
      table.userId,
    ),
  ],
);

export const agentPairingCodeTable = pgTable(
  "agent_pairing_code",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    codeHash: text("code_hash")
      .notNull()
      .unique("agent_pairing_code_hash_unique"),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("agent_pairing_code_userId_idx").on(table.userId)],
);

export const activitySpanTable = pgTable(
  "activity_span",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    deviceId: text("device_id")
      .notNull()
      .references(() => agentDeviceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Chosen by the agent so a retried batch is recorded once.
    clientId: text("client_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    startedAt: timestamp("started_at", { mode: "date" }).notNull(),
    endedAt: timestamp("ended_at", { mode: "date" }).notNull(),
    state: text("state").notNull(),
    app: text("app"),
    domain: text("domain"),
  },
  (table) => [
    unique("activity_span_device_client_unique").on(
      table.deviceId,
      table.clientId,
    ),
    index("activity_span_user_startedAt_idx").on(
      table.workspaceId,
      table.userId,
      table.startedAt,
    ),
    index("activity_span_startedAt_idx").on(table.startedAt),
  ],
);

export const activityDailyTable = pgTable(
  "activity_daily",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    day: date("day", { mode: "string" }).notNull(),
    // Empty string rather than null so the unique key below works.
    app: text("app").notNull().default(""),
    domain: text("domain").notNull().default(""),
    activeSeconds: integer("active_seconds").notNull().default(0),
    idleSeconds: integer("idle_seconds").notNull().default(0),
  },
  (table) => [
    unique("activity_daily_unique").on(
      table.workspaceId,
      table.userId,
      table.day,
      table.app,
      table.domain,
    ),
    index("activity_daily_workspace_day_idx").on(table.workspaceId, table.day),
  ],
);

export const salaryTable = pgTable(
  "salary",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    type: text("type").notNull().default("monthly"),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    note: text("note"),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("salary_user_effectiveFrom_idx").on(
      table.workspaceId,
      table.userId,
      table.effectiveFrom,
    ),
  ],
);

export const payrollRunTable = pgTable(
  "payroll_run",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull().default("draft"),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    approvedBy: text("approved_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    approvedAt: timestamp("approved_at", { mode: "date" }),
    paidAt: timestamp("paid_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("payroll_run_workspace_period_unique").on(
      table.workspaceId,
      table.year,
      table.month,
    ),
  ],
);

export const payrollItemTable = pgTable(
  "payroll_item",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => payrollRunTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Payroll is a financial record that outlives the account, so the name is
    // kept next to a nullable user reference.
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    employeeName: text("employee_name").notNull(),
    salaryType: text("salary_type").notNull(),
    salaryAmount: bigint("salary_amount", { mode: "number" }).notNull(),
    workedMinutes: integer("worked_minutes").notNull().default(0),
    overtimeMinutes: integer("overtime_minutes").notNull().default(0),
    baseAmount: bigint("base_amount", { mode: "number" }).notNull(),
    overtimeAmount: bigint("overtime_amount", { mode: "number" })
      .notNull()
      .default(0),
    // What one overtime hour pays (overtime premium included), and what the
    // overtime came to before anyone edited it. An edited line is one whose
    // amount differs from the automatic one.
    overtimeRate: bigint("overtime_rate", { mode: "number" })
      .notNull()
      .default(0),
    overtimeAutoAmount: bigint("overtime_auto_amount", { mode: "number" })
      .notNull()
      .default(0),
    bonus: bigint("bonus", { mode: "number" }).notNull().default(0),
    deduction: bigint("deduction", { mode: "number" }).notNull().default(0),
    netAmount: bigint("net_amount", { mode: "number" }).notNull(),
    note: text("note"),
  },
  (table) => [
    unique("payroll_item_run_user_unique").on(table.runId, table.userId),
  ],
);

export const leaveRequestTable = pgTable(
  "leave_request",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    type: text("type").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    days: integer("days").notNull(),
    reason: text("reason"),
    status: text("status").notNull().default("pending"),
    decidedBy: text("decided_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    decidedAt: timestamp("decided_at", { mode: "date" }),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("leave_request_workspace_status_idx").on(
      table.workspaceId,
      table.status,
    ),
    index("leave_request_user_startDate_idx").on(
      table.workspaceId,
      table.userId,
      table.startDate,
    ),
  ],
);

export const storedFileTable = pgTable(
  "stored_file",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    uploadedBy: text("uploaded_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    // "db" keeps the bytes in `data`; "s3" keeps them at `objectKey`.
    storage: text("storage").notNull(),
    objectKey: text("object_key"),
    data: bytea("data"),
    // "receipt" files belong to an expense; "file" ones show on the Files page.
    kind: text("kind").notNull().default("receipt"),
    folder: text("folder").notNull().default(""),
    // Set while the file has a public link; clearing it revokes the link.
    shareToken: text("share_token").unique("stored_file_share_token_unique"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("stored_file_workspaceId_idx").on(table.workspaceId),
    index("stored_file_workspace_kind_folder_idx").on(
      table.workspaceId,
      table.kind,
      table.folder,
    ),
  ],
);

// Every email Kaneo sends goes through here: it is sent right away, retried
// with backoff when the provider fails, and kept as a delivery log.
export const emailOutboxTable = pgTable(
  "email_outbox",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaceTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    category: text("category").notNull().default("other"),
    html: text("html").notNull(),
    text: text("text"),
    // queued → sending → sent, or back to queued until attempts run out.
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    provider: text("provider"),
    providerId: text("provider_id"),
    nextAttemptAt: timestamp("next_attempt_at", { mode: "date" })
      .defaultNow()
      .notNull(),
    sentAt: timestamp("sent_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("email_outbox_status_next_idx").on(table.status, table.nextAttemptAt),
    index("email_outbox_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

// Folders on the Files page are mostly implied by file paths; a row here
// keeps a folder someone created visible while it is still empty.
export const fileFolderTable = pgTable(
  "file_folder",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // "Design/Logos/" style, same shape as stored_file.folder.
    path: text("path").notNull(),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("file_folder_workspace_path_idx").on(
      table.workspaceId,
      table.path,
    ),
  ],
);

// A task's "Files & media": either a file in the workspace library (kept in a
// Tasks/<ID>/ folder, so it also shows on the Files page) or a plain link.
export const taskAttachmentTable = pgTable(
  "task_attachment",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // "file" points at stored_file; "link" carries a url.
    kind: text("kind").notNull(),
    fileId: text("file_id").references(() => storedFileTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    url: text("url"),
    title: text("title").notNull(),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("task_attachment_taskId_idx").on(table.taskId),
    index("task_attachment_fileId_idx").on(table.fileId),
  ],
);

// A person's own ordering of their tasks on My work. Separate from
// task.position, which is the shared board order within one project column.
export const userTaskOrderTable = pgTable(
  "user_task_order",
  {
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.taskId] }),
    index("user_task_order_user_workspace_idx").on(
      table.userId,
      table.workspaceId,
    ),
  ],
);

// A workspace's own S3-compatible bucket (Cloudflare R2 and the like). Without
// a row, files are kept in Postgres.
export const workspaceStorageTable = pgTable("workspace_storage", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspaceTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  endpoint: text("endpoint").notNull(),
  bucket: text("bucket").notNull(),
  region: text("region").notNull().default("auto"),
  accessKeyId: text("access_key_id").notNull(),
  // Encrypted at rest; never returned by the API.
  secretAccessKey: text("secret_access_key").notNull(),
  keyPrefix: text("key_prefix").notNull().default(""),
  updatedBy: text("updated_by").references(() => userTable.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const expenseTable = pgTable(
  "expense",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    spentOn: date("spent_on", { mode: "string" }).notNull(),
    projectId: text("project_id").references(() => projectTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    receiptFileId: text("receipt_file_id").references(
      () => storedFileTable.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    status: text("status").notNull().default("pending"),
    decidedBy: text("decided_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    decidedAt: timestamp("decided_at", { mode: "date" }),
    paidAt: timestamp("paid_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("expense_workspace_status_idx").on(table.workspaceId, table.status),
    index("expense_workspace_user_idx").on(table.workspaceId, table.userId),
    index("expense_projectId_idx").on(table.projectId),
    index("expense_receiptFileId_idx").on(table.receiptFileId),
  ],
);

export const auditLogTable = pgTable(
  "audit_log",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    actorId: text("actor_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    data: jsonb("data"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_workspace_createdAt_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

// Workspace chat. A "channel" has a name and is either open to every member
// (anyone can join) or private (invite only); a "dm" is between the people in
// chat_member and has no name. DMs are unique per member set via `dmKey`.
export const chatConversationTable = pgTable(
  "chat_conversation",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    type: text("type").notNull(),
    name: text("name"),
    isPrivate: boolean("is_private").notNull().default(false),
    // Sorted member ids joined with ":" for DMs, so reopening one finds it.
    dmKey: text("dm_key"),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    lastMessageAt: timestamp("last_message_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("chat_conversation_workspace_idx").on(table.workspaceId),
    uniqueIndex("chat_conversation_workspace_dm_key_idx").on(
      table.workspaceId,
      table.dmKey,
    ),
  ],
);

export const chatMemberTable = pgTable(
  "chat_member",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => chatConversationTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Compared with chat_message.created_at, which the API stamps, so this
    // default comes from the same (API) clock rather than Postgres's now().
    lastReadAt: timestamp("last_read_at", { mode: "date" })
      .defaultNow()
      .$defaultFn(() => new Date())
      .notNull(),
    joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("chat_member_conversation_user_idx").on(
      table.conversationId,
      table.userId,
    ),
    index("chat_member_user_idx").on(table.userId),
  ],
);

export const chatMessageTable = pgTable(
  "chat_message",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => chatConversationTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    body: text("body").notNull(),
    // Set null when the quoted message is deleted; the reply stays.
    replyToId: text("reply_to_id").references(
      (): AnyPgColumn => chatMessageTable.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    editedAt: timestamp("edited_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("chat_message_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const chatReactionTable = pgTable(
  "chat_reaction",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessageTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("chat_reaction_message_user_emoji_idx").on(
      table.messageId,
      table.userId,
      table.emoji,
    ),
  ],
);

// Emoji reactions on task comments (activity rows of type "comment").
export const activityReactionTable = pgTable(
  "activity_reaction",
  {
    activityId: text("activity_id")
      .notNull()
      .references(() => activityTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("activity_reaction_activity_user_emoji_idx").on(
      table.activityId,
      table.userId,
      table.emoji,
    ),
  ],
);
