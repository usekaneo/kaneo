import { createHmac } from "node:crypto";
import { sendNotificationEmail } from "@kaneo/email";
import { and, eq } from "drizzle-orm";
import db from "../database";
import {
  notificationTable,
  projectTable,
  taskTable,
  userNotificationPreferenceTable,
  userNotificationWorkspaceRuleTable,
  userTable,
  workspaceTable,
} from "../database/schema";
import { assertPublicWebhookDestination } from "../plugins/generic-webhook/config";

const DEFAULT_OUTBOUND_FETCH_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? DEFAULT_OUTBOUND_FETCH_TIMEOUT_MS;
  const { timeoutMs: _timeout, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type ResolvedNotificationContext = {
  workspaceId: string;
  workspaceName: string;
  projectId: string | null;
  projectName: string | null;
  taskId: string | null;
  taskTitle: string | null;
  taskUrl: string | null;
};

type DeliveryContent = {
  title: string;
  body: string;
};

function buildTaskUrl(workspaceId: string, projectId: string, taskId: string) {
  const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
  return `${clientUrl}/dashboard/workspace/${workspaceId}/project/${projectId}/task/${taskId}`;
}

function getStringValue(
  data: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = data?.[key];
  return typeof value === "string" ? value : null;
}

function buildDeliveryContent(notification: {
  type: string;
  content: string | null;
  title: string | null;
  eventData: Record<string, unknown> | null;
}): DeliveryContent {
  if (notification.title && notification.content) {
    return {
      title: notification.title,
      body: notification.content,
    };
  }

  switch (notification.type) {
    case "task_created": {
      const taskTitle = getStringValue(notification.eventData, "taskTitle");
      return {
        title: "New task created",
        body: taskTitle
          ? `A new task was created: ${taskTitle}`
          : "A new task was created in Kaneo.",
      };
    }
    case "workspace_created": {
      const workspaceName = getStringValue(
        notification.eventData,
        "workspaceName",
      );
      return {
        title: "Workspace created",
        body: workspaceName
          ? `Workspace created: ${workspaceName}`
          : "A new workspace was created in Kaneo.",
      };
    }
    case "task_status_changed": {
      const taskTitle = getStringValue(notification.eventData, "taskTitle");
      const oldStatus = getStringValue(notification.eventData, "oldStatus");
      const newStatus = getStringValue(notification.eventData, "newStatus");
      return {
        title: "Task status changed",
        body:
          taskTitle && oldStatus && newStatus
            ? `${taskTitle} moved from ${oldStatus} to ${newStatus}.`
            : "A task status changed in Kaneo.",
      };
    }
    case "task_assignee_changed": {
      const taskTitle = getStringValue(notification.eventData, "taskTitle");
      return {
        title: "Task assigned to you",
        body: taskTitle
          ? `You were assigned to ${taskTitle}.`
          : "A task was assigned to you in Kaneo.",
      };
    }
    case "time_entry_created": {
      const taskTitle = getStringValue(notification.eventData, "taskTitle");
      return {
        title: "Time entry created",
        body: taskTitle
          ? `A time entry was created for ${taskTitle}.`
          : "A time entry was created in Kaneo.",
      };
    }
    default:
      return {
        title: notification.title ?? "New Kaneo notification",
        body: notification.content ?? "You have a new notification in Kaneo.",
      };
  }
}

async function resolveNotificationContext(notification: {
  resourceType: string | null;
  resourceId: string | null;
}): Promise<ResolvedNotificationContext | null> {
  if (!notification.resourceType || !notification.resourceId) {
    return null;
  }

  if (notification.resourceType === "task") {
    const [task] = await db
      .select({
        taskId: taskTable.id,
        taskTitle: taskTable.title,
        projectId: projectTable.id,
        projectName: projectTable.name,
        workspaceId: workspaceTable.id,
        workspaceName: workspaceTable.name,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .innerJoin(
        workspaceTable,
        eq(projectTable.workspaceId, workspaceTable.id),
      )
      .where(eq(taskTable.id, notification.resourceId))
      .limit(1);

    if (!task) {
      return null;
    }

    return {
      workspaceId: task.workspaceId,
      workspaceName: task.workspaceName,
      projectId: task.projectId,
      projectName: task.projectName,
      taskId: task.taskId,
      taskTitle: task.taskTitle,
      taskUrl: buildTaskUrl(task.workspaceId, task.projectId, task.taskId),
    };
  }

  if (notification.resourceType === "workspace") {
    const [workspace] = await db
      .select({
        workspaceId: workspaceTable.id,
        workspaceName: workspaceTable.name,
      })
      .from(workspaceTable)
      .where(eq(workspaceTable.id, notification.resourceId))
      .limit(1);

    if (!workspace) {
      return null;
    }

    return {
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName,
      projectId: null,
      projectName: null,
      taskId: null,
      taskTitle: null,
      taskUrl: null,
    };
  }

  return null;
}

async function sendNtfyNotification(input: {
  serverUrl: string;
  topic: string;
  token?: string | null;
  title: string;
  body: string;
  clickUrl?: string | null;
}) {
  await assertPublicWebhookDestination(input.serverUrl);

  const response = await fetchWithTimeout(
    `${input.serverUrl.replace(/\/+$/, "")}/${encodeURIComponent(input.topic)}`,
    {
      method: "POST",
      headers: {
        ...(input.token ? { Authorization: `Bearer ${input.token}` } : {}),
        ...(input.clickUrl ? { Click: input.clickUrl } : {}),
        Title: input.title,
      },
      body: input.body,
    },
  );

  if (!response.ok) {
    throw new Error(
      `ntfy delivery failed (${response.status}): ${await response.text()}`,
    );
  }
}

async function sendGotifyNotification(input: {
  serverUrl: string;
  token: string;
  title: string;
  body: string;
  clickUrl?: string | null;
}) {
  await assertPublicWebhookDestination(input.serverUrl);

  // Gotify expects the app token in the query string; that can surface in logs, proxies, and browser history — factor this into Gotify placement and log handling.
  const response = await fetchWithTimeout(
    `${input.serverUrl.replace(/\/+$/, "")}/message?token=${encodeURIComponent(
      input.token,
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: input.title,
        message: input.body,
        priority: 5,
        extras: input.clickUrl
          ? {
              "client::notification": {
                click: {
                  url: input.clickUrl,
                },
              },
              "client::display": {
                contentType: "text/plain",
              },
            }
          : undefined,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Gotify delivery failed (${response.status}): ${await response.text()}`,
    );
  }
}

async function sendWebhookNotification(input: {
  webhookUrl: string;
  secret?: string | null;
  payload: Record<string, unknown>;
}) {
  await assertPublicWebhookDestination(input.webhookUrl);

  const body = JSON.stringify(input.payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (input.secret) {
    headers["X-Kaneo-Signature"] = createHmac("sha256", input.secret)
      .update(body)
      .digest("hex");
  }

  const response = await fetchWithTimeout(input.webhookUrl, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    throw new Error(
      `Webhook delivery failed (${response.status}): ${await response.text()}`,
    );
  }
}

export async function deliverNotification(
  notificationId: string,
): Promise<void> {
  const notification = await db.query.notificationTable.findFirst({
    where: eq(notificationTable.id, notificationId),
  });

  if (!notification) {
    return;
  }

  const context = await resolveNotificationContext(notification);
  if (!context) {
    console.info("Notification delivery skipped: unresolved context", {
      notificationId,
      notificationTableId: notification.id,
      resourceType: notification.resourceType,
      resourceId: notification.resourceId,
      reason:
        "resolveNotificationContext returned null (missing resource, deleted task, or unsupported resource type)",
    });
    return;
  }

  const [user] = await db
    .select({
      email: userTable.email,
      name: userTable.name,
      locale: userTable.locale,
    })
    .from(userTable)
    .where(eq(userTable.id, notification.userId))
    .limit(1);

  if (!user) {
    return;
  }

  const preference = await db.query.userNotificationPreferenceTable.findFirst({
    where: eq(userNotificationPreferenceTable.userId, notification.userId),
  });

  if (!preference) {
    return;
  }

  const rule = await db.query.userNotificationWorkspaceRuleTable.findFirst({
    where: and(
      eq(userNotificationWorkspaceRuleTable.userId, notification.userId),
      eq(userNotificationWorkspaceRuleTable.workspaceId, context.workspaceId),
    ),
    with: {
      selectedProjects: true,
    },
  });

  if (!rule?.isActive) {
    return;
  }

  if (
    context.projectId &&
    rule.projectMode === "selected" &&
    !rule.selectedProjects.some(
      (project) => project.projectId === context.projectId,
    )
  ) {
    return;
  }

  const content = buildDeliveryContent({
    type: notification.type,
    title: notification.title ?? null,
    content: notification.content ?? null,
    eventData:
      notification.eventData && typeof notification.eventData === "object"
        ? (notification.eventData as Record<string, unknown>)
        : null,
  });

  const webhookPayload = {
    notification: {
      id: notification.id,
      type: notification.type,
      title: content.title,
      content: content.body,
      createdAt: notification.createdAt,
      eventData: notification.eventData,
      resourceId: notification.resourceId,
      resourceType: notification.resourceType,
    },
    workspace: {
      id: context.workspaceId,
      name: context.workspaceName,
    },
    project: context.projectId
      ? {
          id: context.projectId,
          name: context.projectName,
        }
      : null,
    task: context.taskId
      ? {
          id: context.taskId,
          title: context.taskTitle,
          url: context.taskUrl,
        }
      : null,
    user: {
      id: notification.userId,
      email: user.email,
      name: user.name,
    },
  };

  const deliveries: Array<Promise<void>> = [];

  if (preference.emailEnabled && rule.emailEnabled && user.email) {
    deliveries.push(
      sendNotificationEmail(user.email, content.title, {
        title: content.title,
        message: content.body,
        actionUrl: context.taskUrl,
        actionLabel: context.taskUrl ? "Open in Kaneo" : undefined,
        locale: user.locale ?? null,
      }),
    );
  }

  if (
    preference.ntfyEnabled &&
    preference.ntfyServerUrl &&
    preference.ntfyTopic &&
    rule.ntfyEnabled
  ) {
    deliveries.push(
      sendNtfyNotification({
        serverUrl: preference.ntfyServerUrl,
        topic: preference.ntfyTopic,
        token: preference.ntfyToken,
        title: content.title,
        body: content.body,
        clickUrl: context.taskUrl,
      }),
    );
  }

  if (
    preference.gotifyEnabled &&
    preference.gotifyServerUrl &&
    preference.gotifyToken &&
    rule.gotifyEnabled
  ) {
    deliveries.push(
      sendGotifyNotification({
        serverUrl: preference.gotifyServerUrl,
        token: preference.gotifyToken,
        title: content.title,
        body: content.body,
        clickUrl: context.taskUrl,
      }),
    );
  }

  if (
    preference.webhookEnabled &&
    preference.webhookUrl &&
    rule.webhookEnabled
  ) {
    deliveries.push(
      sendWebhookNotification({
        webhookUrl: preference.webhookUrl,
        secret: preference.webhookSecret,
        payload: webhookPayload,
      }),
    );
  }

  const results = await Promise.allSettled(deliveries);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Notification delivery failed", {
        notificationId,
        error: result.reason,
      });
    }
  }
}
