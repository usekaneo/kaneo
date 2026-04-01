import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import {
  projectTable,
  userNotificationPreferenceTable,
  userNotificationWorkspaceProjectTable,
  userNotificationWorkspaceRuleTable,
  workspaceUserTable,
} from "../database/schema";
import { assertPublicWebhookDestination } from "../plugins/generic-webhook/config";

export type NotificationPreferenceProjectMode = "all" | "selected";

export type NotificationPreferenceResponse = {
  emailAddress: string | null;
  emailEnabled: boolean;
  ntfyEnabled: boolean;
  ntfyConfigured: boolean;
  ntfyServerUrl: string | null;
  ntfyTopic: string | null;
  ntfyTokenConfigured: boolean;
  maskedNtfyToken: string | null;
  gotifyEnabled: boolean;
  gotifyConfigured: boolean;
  gotifyServerUrl: string | null;
  gotifyTokenConfigured: boolean;
  maskedGotifyToken: string | null;
  webhookEnabled: boolean;
  webhookConfigured: boolean;
  webhookUrl: string | null;
  webhookSecretConfigured: boolean;
  maskedWebhookSecret: string | null;
  workspaces: Array<{
    id: string;
    workspaceId: string;
    workspaceName: string;
    isActive: boolean;
    emailEnabled: boolean;
    ntfyEnabled: boolean;
    gotifyEnabled: boolean;
    webhookEnabled: boolean;
    projectMode: NotificationPreferenceProjectMode;
    selectedProjectIds: string[];
    createdAt: Date;
    updatedAt: Date;
  }>;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type UpdateNotificationPreferenceInput = {
  emailEnabled?: boolean;
  ntfyEnabled?: boolean;
  ntfyServerUrl?: string | null;
  ntfyTopic?: string | null;
  ntfyToken?: string | null;
  gotifyEnabled?: boolean;
  gotifyServerUrl?: string | null;
  gotifyToken?: string | null;
  webhookEnabled?: boolean;
  webhookUrl?: string | null;
  webhookSecret?: string | null;
};

export type UpsertWorkspaceRuleInput = {
  isActive: boolean;
  emailEnabled: boolean;
  ntfyEnabled: boolean;
  gotifyEnabled: boolean;
  webhookEnabled: boolean;
  projectMode: NotificationPreferenceProjectMode;
  selectedProjectIds?: string[];
};

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return value === null ? null : undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function maskValue(value: string | undefined | null): string | null {
  if (!value) return null;
  return value.length > 8 ? `${value.slice(0, 4)}…${value.slice(-4)}` : "••••";
}

async function assertWorkspaceMembership(userId: string, workspaceId: string) {
  const [membership] = await db
    .select({ workspaceId: workspaceUserTable.workspaceId })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.userId, userId),
        eq(workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new HTTPException(403, {
      message: "You don't have access to this workspace",
    });
  }
}

export async function validateProjectSelection(
  workspaceId: string,
  selectedProjectIds: string[],
) {
  if (selectedProjectIds.length === 0) {
    throw new HTTPException(400, {
      message: "Select at least one project for selected project mode",
    });
  }

  const projects = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        inArray(projectTable.id, selectedProjectIds),
      ),
    );

  if (projects.length !== selectedProjectIds.length) {
    throw new HTTPException(400, {
      message: "One or more selected projects are invalid",
    });
  }
}

export async function getNotificationPreferences(
  userId: string,
  emailAddress: string | null,
): Promise<NotificationPreferenceResponse> {
  const preference = await db.query.userNotificationPreferenceTable.findFirst({
    where: eq(userNotificationPreferenceTable.userId, userId),
  });

  const rules = await db.query.userNotificationWorkspaceRuleTable.findMany({
    where: eq(userNotificationWorkspaceRuleTable.userId, userId),
    with: {
      workspace: true,
      selectedProjects: true,
    },
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });

  return {
    emailAddress,
    emailEnabled: preference?.emailEnabled ?? false,
    ntfyEnabled: preference?.ntfyEnabled ?? false,
    ntfyConfigured: Boolean(preference?.ntfyServerUrl && preference?.ntfyTopic),
    ntfyServerUrl: preference?.ntfyServerUrl ?? null,
    ntfyTopic: preference?.ntfyTopic ?? null,
    ntfyTokenConfigured: Boolean(preference?.ntfyToken),
    maskedNtfyToken: maskValue(preference?.ntfyToken),
    gotifyEnabled: preference?.gotifyEnabled ?? false,
    gotifyConfigured: Boolean(
      preference?.gotifyServerUrl && preference?.gotifyToken,
    ),
    gotifyServerUrl: preference?.gotifyServerUrl ?? null,
    gotifyTokenConfigured: Boolean(preference?.gotifyToken),
    maskedGotifyToken: maskValue(preference?.gotifyToken),
    webhookEnabled: preference?.webhookEnabled ?? false,
    webhookConfigured: Boolean(preference?.webhookUrl),
    webhookUrl: preference?.webhookUrl ?? null,
    webhookSecretConfigured: Boolean(preference?.webhookSecret),
    maskedWebhookSecret: maskValue(preference?.webhookSecret),
    workspaces: rules.map((rule) => ({
      id: rule.id,
      workspaceId: rule.workspaceId,
      workspaceName: rule.workspace.name,
      isActive: rule.isActive ?? true,
      emailEnabled: rule.emailEnabled ?? false,
      ntfyEnabled: rule.ntfyEnabled ?? false,
      gotifyEnabled: rule.gotifyEnabled ?? false,
      webhookEnabled: rule.webhookEnabled ?? false,
      projectMode:
        rule.projectMode === "selected" ? "selected" : ("all" as const),
      selectedProjectIds: rule.selectedProjects.map(
        (project) => project.projectId,
      ),
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    })),
    createdAt: preference?.createdAt ?? null,
    updatedAt: preference?.updatedAt ?? null,
  };
}

export async function updateNotificationPreferences(
  userId: string,
  emailAddress: string | null,
  input: UpdateNotificationPreferenceInput,
): Promise<NotificationPreferenceResponse> {
  const existing = await db.query.userNotificationPreferenceTable.findFirst({
    where: eq(userNotificationPreferenceTable.userId, userId),
  });

  const ntfyServerUrl = normalizeOptionalString(
    input.ntfyServerUrl ?? existing?.ntfyServerUrl,
  );
  const ntfyTopic = normalizeOptionalString(
    input.ntfyTopic ?? existing?.ntfyTopic,
  );
  const ntfyToken = normalizeOptionalString(input.ntfyToken ?? undefined);
  const gotifyServerUrl = normalizeOptionalString(
    input.gotifyServerUrl ?? existing?.gotifyServerUrl,
  );
  const gotifyToken = normalizeOptionalString(input.gotifyToken ?? undefined);
  const webhookUrl = normalizeOptionalString(
    input.webhookUrl ?? existing?.webhookUrl,
  );
  const webhookSecret = normalizeOptionalString(
    input.webhookSecret ?? undefined,
  );

  const emailEnabled = input.emailEnabled ?? existing?.emailEnabled ?? false;
  const ntfyEnabled = input.ntfyEnabled ?? existing?.ntfyEnabled ?? false;
  const gotifyEnabled = input.gotifyEnabled ?? existing?.gotifyEnabled ?? false;
  const webhookEnabled =
    input.webhookEnabled ?? existing?.webhookEnabled ?? false;

  if (emailEnabled && !emailAddress) {
    throw new HTTPException(400, {
      message: "Email notifications require an account email address",
    });
  }

  if (ntfyEnabled || ntfyServerUrl || ntfyTopic || ntfyToken !== undefined) {
    if (!ntfyServerUrl || !ntfyTopic) {
      throw new HTTPException(400, {
        message: "ntfy requires a server URL and topic",
      });
    }

    try {
      new URL(ntfyServerUrl);
      await assertPublicWebhookDestination(ntfyServerUrl);
    } catch (error) {
      throw new HTTPException(400, {
        message:
          error instanceof Error ? error.message : "Invalid ntfy server URL",
      });
    }
  }

  if (gotifyEnabled || gotifyServerUrl || gotifyToken !== undefined) {
    if (!gotifyServerUrl || !gotifyToken) {
      throw new HTTPException(400, {
        message: "Gotify requires a server URL and app token",
      });
    }

    try {
      new URL(gotifyServerUrl);
      await assertPublicWebhookDestination(gotifyServerUrl);
    } catch (error) {
      throw new HTTPException(400, {
        message:
          error instanceof Error ? error.message : "Invalid Gotify server URL",
      });
    }
  }

  if (webhookEnabled || webhookUrl || webhookSecret !== undefined) {
    if (!webhookUrl) {
      throw new HTTPException(400, {
        message: "Webhook notifications require an endpoint URL",
      });
    }

    try {
      new URL(webhookUrl);
      await assertPublicWebhookDestination(webhookUrl);
    } catch (error) {
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : "Invalid webhook URL",
      });
    }
  }

  const data = {
    userId,
    emailEnabled,
    ntfyEnabled,
    ntfyServerUrl,
    ntfyTopic,
    ntfyToken:
      ntfyToken === undefined ? (existing?.ntfyToken ?? null) : ntfyToken,
    gotifyEnabled,
    gotifyServerUrl,
    gotifyToken:
      gotifyToken === undefined ? (existing?.gotifyToken ?? null) : gotifyToken,
    webhookEnabled,
    webhookUrl,
    webhookSecret:
      webhookSecret === undefined
        ? (existing?.webhookSecret ?? null)
        : webhookSecret,
  };

  if (existing) {
    await db
      .update(userNotificationPreferenceTable)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userNotificationPreferenceTable.userId, userId));
  } else {
    await db.insert(userNotificationPreferenceTable).values(data);
  }

  const ruleCascade: {
    emailEnabled?: boolean;
    ntfyEnabled?: boolean;
    gotifyEnabled?: boolean;
    webhookEnabled?: boolean;
  } = {};

  if (!emailEnabled) {
    ruleCascade.emailEnabled = false;
  }

  if (!ntfyEnabled || !ntfyServerUrl || !ntfyTopic) {
    ruleCascade.ntfyEnabled = false;
  }

  if (!gotifyEnabled || !gotifyServerUrl || !data.gotifyToken) {
    ruleCascade.gotifyEnabled = false;
  }

  if (!webhookEnabled || !webhookUrl) {
    ruleCascade.webhookEnabled = false;
  }

  if (Object.keys(ruleCascade).length > 0) {
    await db
      .update(userNotificationWorkspaceRuleTable)
      .set({
        ...ruleCascade,
        updatedAt: new Date(),
      })
      .where(eq(userNotificationWorkspaceRuleTable.userId, userId));
  }

  return getNotificationPreferences(userId, emailAddress);
}

export async function upsertWorkspaceRule(
  userId: string,
  workspaceId: string,
  emailAddress: string | null,
  input: UpsertWorkspaceRuleInput,
): Promise<NotificationPreferenceResponse> {
  await assertWorkspaceMembership(userId, workspaceId);

  if (input.projectMode === "selected") {
    await validateProjectSelection(workspaceId, input.selectedProjectIds ?? []);
  }

  const preference = await db.query.userNotificationPreferenceTable.findFirst({
    where: eq(userNotificationPreferenceTable.userId, userId),
  });

  if (input.emailEnabled && (!preference?.emailEnabled || !emailAddress)) {
    throw new HTTPException(400, {
      message: "Enable email notifications globally before using them here",
    });
  }

  if (
    input.ntfyEnabled &&
    (!preference?.ntfyEnabled ||
      !preference.ntfyServerUrl ||
      !preference.ntfyTopic)
  ) {
    throw new HTTPException(400, {
      message: "Enable ntfy notifications globally before using them here",
    });
  }

  if (
    input.webhookEnabled &&
    (!preference?.webhookEnabled || !preference.webhookUrl)
  ) {
    throw new HTTPException(400, {
      message: "Enable webhook notifications globally before using them here",
    });
  }

  if (
    input.gotifyEnabled &&
    (!preference?.gotifyEnabled ||
      !preference.gotifyServerUrl ||
      !preference.gotifyToken)
  ) {
    throw new HTTPException(400, {
      message: "Enable Gotify notifications globally before using them here",
    });
  }

  const existing = await db.query.userNotificationWorkspaceRuleTable.findFirst({
    where: and(
      eq(userNotificationWorkspaceRuleTable.userId, userId),
      eq(userNotificationWorkspaceRuleTable.workspaceId, workspaceId),
    ),
  });

  let ruleId = existing?.id;

  if (existing) {
    await db
      .update(userNotificationWorkspaceRuleTable)
      .set({
        isActive: input.isActive,
        emailEnabled: input.emailEnabled,
        ntfyEnabled: input.ntfyEnabled,
        gotifyEnabled: input.gotifyEnabled,
        webhookEnabled: input.webhookEnabled,
        projectMode: input.projectMode,
        updatedAt: new Date(),
      })
      .where(eq(userNotificationWorkspaceRuleTable.id, existing.id));
  } else {
    const [createdRule] = await db
      .insert(userNotificationWorkspaceRuleTable)
      .values({
        userId,
        workspaceId,
        isActive: input.isActive,
        emailEnabled: input.emailEnabled,
        ntfyEnabled: input.ntfyEnabled,
        gotifyEnabled: input.gotifyEnabled,
        webhookEnabled: input.webhookEnabled,
        projectMode: input.projectMode,
      })
      .returning({ id: userNotificationWorkspaceRuleTable.id });
    ruleId = createdRule?.id;
  }

  if (!ruleId) {
    throw new HTTPException(500, {
      message: "Failed to save notification workspace rule",
    });
  }

  const workspaceRuleId = ruleId;

  await db
    .delete(userNotificationWorkspaceProjectTable)
    .where(
      eq(
        userNotificationWorkspaceProjectTable.workspaceRuleId,
        workspaceRuleId,
      ),
    );

  if (input.projectMode === "selected") {
    await db.insert(userNotificationWorkspaceProjectTable).values(
      (input.selectedProjectIds ?? []).map((projectId) => ({
        workspaceId,
        workspaceRuleId,
        projectId,
      })),
    );
  }

  return getNotificationPreferences(userId, emailAddress);
}

export async function deleteWorkspaceRule(
  userId: string,
  workspaceId: string,
  emailAddress: string | null,
): Promise<NotificationPreferenceResponse> {
  await assertWorkspaceMembership(userId, workspaceId);

  const existing = await db.query.userNotificationWorkspaceRuleTable.findFirst({
    where: and(
      eq(userNotificationWorkspaceRuleTable.userId, userId),
      eq(userNotificationWorkspaceRuleTable.workspaceId, workspaceId),
    ),
  });

  if (!existing) {
    throw new HTTPException(404, {
      message: "Workspace notification rule not found",
    });
  }

  await db
    .delete(userNotificationWorkspaceRuleTable)
    .where(eq(userNotificationWorkspaceRuleTable.id, existing.id));

  return getNotificationPreferences(userId, emailAddress);
}
