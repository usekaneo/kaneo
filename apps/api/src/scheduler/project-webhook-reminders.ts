import { and, between, eq, isNull, or } from "drizzle-orm";
import db from "../database";
import {
  columnTable,
  integrationTable,
  taskReminderSentTable,
  taskTable,
} from "../database/schema";
import {
  type GenericWebhookConfig,
  normalizeGenericWebhookConfig,
} from "../plugins/generic-webhook/config";
import { sendDueDateReminder } from "../plugins/generic-webhook/events";
import { isReminderDue } from "./reminder-timing";

const MINUTE_MS = 60 * 1000;
const MAX_LEAD_TIME_MINUTES = 43_200;

export async function checkProjectWebhookReminders(): Promise<void> {
  const now = new Date();
  const integrations = await db
    .select({
      id: integrationTable.id,
      projectId: integrationTable.projectId,
      config: integrationTable.config,
    })
    .from(integrationTable)
    .where(
      and(
        eq(integrationTable.type, "generic-webhook"),
        eq(integrationTable.isActive, true),
      ),
    );

  for (const integration of integrations) {
    try {
      const config = normalizeGenericWebhookConfig(
        JSON.parse(integration.config) as GenericWebhookConfig,
      );
      if (!config.events?.dueDateReminder) continue;

      const leadTimeMinutes = config.dueDateReminderLeadTimeMinutes ?? 1440;
      const reminderType = `generic_webhook:${integration.id}`;
      const tasks = await db
        .select({ id: taskTable.id, dueDate: taskTable.dueDate })
        .from(taskTable)
        .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
        .leftJoin(
          taskReminderSentTable,
          and(
            eq(taskReminderSentTable.taskId, taskTable.id),
            eq(taskReminderSentTable.reminderType, reminderType),
          ),
        )
        .where(
          and(
            eq(taskTable.projectId, integration.projectId),
            between(
              taskTable.dueDate,
              now,
              new Date(now.getTime() + MAX_LEAD_TIME_MINUTES * MINUTE_MS),
            ),
            isNull(taskReminderSentTable.id),
            or(isNull(columnTable.isFinal), eq(columnTable.isFinal, false)),
          ),
        );

      for (const task of tasks) {
        if (
          !task.dueDate ||
          !isReminderDue({ dueDate: task.dueDate, leadTimeMinutes, now })
        ) {
          continue;
        }

        const [sentRecord] = await db
          .insert(taskReminderSentTable)
          .values({ taskId: task.id, reminderType })
          .onConflictDoNothing({
            target: [
              taskReminderSentTable.taskId,
              taskReminderSentTable.reminderType,
            ],
          })
          .returning({ id: taskReminderSentTable.id });
        if (!sentRecord) continue;

        const delivered = await sendDueDateReminder(
          config,
          task.id,
          integration.projectId,
          leadTimeMinutes,
          task.dueDate,
        );

        if (!delivered) {
          await db
            .delete(taskReminderSentTable)
            .where(eq(taskReminderSentTable.id, sentRecord.id));
        }
      }
    } catch (error) {
      console.error("Failed to process project webhook reminder", {
        integrationId: integration.id,
        projectId: integration.projectId,
        error,
      });
    }
  }
}
