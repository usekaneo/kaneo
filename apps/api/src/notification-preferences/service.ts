import { and, eq, inArray, or } from "drizzle-orm";
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
import { decryptSecret, encryptSecret } from "./secrets";

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

type WorkspaceRuleChannelState = {
  emailEnabled: boolean;
  ntfyEnabled: boolean;
  gotifyEnabled: boolean;
  webhookEnabled: boolean;
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

function normalizeSecretInput(
  inputValue: string | null | undefined,
  existingValue: string | null | undefined,
) {
  if (inputValue === undefined) {
    return normalizeOptionalString(existingValue ?? undefined);
  }

  return normalizeOptionalString(inputValue);
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

  const decryptedPreference = preference
    ? {
        ...preference,
        ntfyToken: decryptSecret(preference.ntfyToken),
        gotifyToken: decryptSecret(preference.gotifyToken),
        webhookSecret: decryptSecret(preference.webhookSecret),
      }
    : null;

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
    emailEnabled: decryptedPreference?.emailEnabled ?? false,
    ntfyEnabled: decryptedPreference?.ntfyEnabled ?? false,
    ntfyConfigured: Boolean(
      decryptedPreference?.ntfyServerUrl && decryptedPreference?.ntfyTopic,
    ),
    ntfyServerUrl: decryptedPreference?.ntfyServerUrl ?? null,
    ntfyTopic: decryptedPreference?.ntfyTopic ?? null,
    ntfyTokenConfigured: Boolean(decryptedPreference?.ntfyToken),
    maskedNtfyToken: maskValue(decryptedPreference?.ntfyToken),
    gotifyEnabled: decryptedPreference?.gotifyEnabled ?? false,
    gotifyConfigured: Boolean(
      decryptedPreference?.gotifyServerUrl && decryptedPreference?.gotifyToken,
    ),
    gotifyServerUrl: decryptedPreference?.gotifyServerUrl ?? null,
    gotifyTokenConfigured: Boolean(decryptedPreference?.gotifyToken),
    maskedGotifyToken: maskValue(decryptedPreference?.gotifyToken),
    webhookEnabled: decryptedPreference?.webhookEnabled ?? false,
    webhookConfigured: Boolean(decryptedPreference?.webhookUrl),
    webhookUrl: decryptedPreference?.webhookUrl ?? null,
    webhookSecretConfigured: Boolean(decryptedPreference?.webhookSecret),
    maskedWebhookSecret: maskValue(decryptedPreference?.webhookSecret),
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

  const decryptedExisting = existing
    ? {
        ...existing,
        ntfyToken: decryptSecret(existing.ntfyToken),
        gotifyToken: decryptSecret(existing.gotifyToken),
        webhookSecret: decryptSecret(existing.webhookSecret),
      }
    : null;

  const ntfyServerUrl = normalizeOptionalString(
    input.ntfyServerUrl ?? decryptedExisting?.ntfyServerUrl,
  );
  const ntfyTopic = normalizeOptionalString(
    input.ntfyTopic ?? decryptedExisting?.ntfyTopic,
  );
  const ntfyToken = normalizeSecretInput(
    input.ntfyToken,
    decryptedExisting?.ntfyToken,
  );
  const gotifyServerUrl = normalizeOptionalString(
    input.gotifyServerUrl ?? decryptedExisting?.gotifyServerUrl,
  );
  const gotifyToken = normalizeSecretInput(
    input.gotifyToken,
    decryptedExisting?.gotifyToken,
  );
  const webhookUrl = normalizeOptionalString(
    input.webhookUrl ?? decryptedExisting?.webhookUrl,
  );
  const webhookSecret = normalizeSecretInput(
    input.webhookSecret,
    decryptedExisting?.webhookSecret,
  );

  const emailEnabled =
    input.emailEnabled ?? decryptedExisting?.emailEnabled ?? false;
  const ntfyEnabled =
    input.ntfyEnabled ?? decryptedExisting?.ntfyEnabled ?? false;
  const gotifyEnabled =
    input.gotifyEnabled ?? decryptedExisting?.gotifyEnabled ?? false;
  const webhookEnabled =
    input.webhookEnabled ?? decryptedExisting?.webhookEnabled ?? false;

  const enabledRuleCascade: WorkspaceRuleChannelState = {
    emailEnabled: false,
    ntfyEnabled: false,
    gotifyEnabled: false,
    webhookEnabled: false,
  };

  const shouldValidateNtfy =
    ntfyEnabled ||
    input.ntfyServerUrl !== undefined ||
    input.ntfyTopic !== undefined ||
    input.ntfyToken !== undefined;

  const shouldValidateGotify =
    gotifyEnabled ||
    input.gotifyServerUrl !== undefined ||
    input.gotifyToken !== undefined;

  const shouldValidateWebhook =
    webhookEnabled ||
    input.webhookUrl !== undefined ||
    input.webhookSecret !== undefined;

  if (emailEnabled && !emailAddress) {
    throw new HTTPException(400, {
      message: "Email notifications require an account email address",
    });
  }

  if (shouldValidateNtfy) {
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

  if (shouldValidateGotify) {
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

  if (shouldValidateWebhook) {
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
      input.ntfyToken === undefined
        ? (existing?.ntfyToken ?? null)
        : (encryptSecret(ntfyToken) ?? null),
    gotifyEnabled,
    gotifyServerUrl,
    gotifyToken:
      input.gotifyToken === undefined
        ? (existing?.gotifyToken ?? null)
        : (encryptSecret(gotifyToken) ?? null),
    webhookEnabled,
    webhookUrl,
    webhookSecret:
      input.webhookSecret === undefined
        ? (existing?.webhookSecret ?? null)
        : (encryptSecret(webhookSecret) ?? null),
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

  const hadEmailEnabled = decryptedExisting?.emailEnabled ?? false;
  const hadNtfyEnabled = decryptedExisting?.ntfyEnabled ?? false;
  const hadGotifyEnabled = decryptedExisting?.gotifyEnabled ?? false;
  const hadWebhookEnabled = decryptedExisting?.webhookEnabled ?? false;

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

  if (emailEnabled && !hadEmailEnabled && emailAddress) {
    enabledRuleCascade.emailEnabled = true;
  }

  if (ntfyEnabled && !hadNtfyEnabled && ntfyServerUrl && ntfyTopic) {
    enabledRuleCascade.ntfyEnabled = true;
  }

  if (
    gotifyEnabled &&
    !hadGotifyEnabled &&
    gotifyServerUrl &&
    data.gotifyToken
  ) {
    enabledRuleCascade.gotifyEnabled = true;
  }

  if (webhookEnabled && !hadWebhookEnabled && webhookUrl) {
    enabledRuleCascade.webhookEnabled = true;
  }

  const ruleEnableCascade = Object.fromEntries(
    Object.entries(enabledRuleCascade).filter(([, value]) => value),
  ) as Partial<WorkspaceRuleChannelState>;

  if (
    Object.keys(ruleCascade).length > 0 ||
    Object.keys(ruleEnableCascade).length > 0
  ) {
    await db
      .update(userNotificationWorkspaceRuleTable)
      .set({
        ...ruleEnableCascade,
        ...ruleCascade,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userNotificationWorkspaceRuleTable.userId, userId),
          eq(userNotificationWorkspaceRuleTable.isActive, true),
          or(
            eq(userNotificationWorkspaceRuleTable.emailEnabled, true),
            eq(userNotificationWorkspaceRuleTable.ntfyEnabled, true),
            eq(userNotificationWorkspaceRuleTable.gotifyEnabled, true),
            eq(userNotificationWorkspaceRuleTable.webhookEnabled, true),
          ),
        ),
      );
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
