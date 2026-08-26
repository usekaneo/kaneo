import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { calBookingTable, taskTable } from "../../database/schema";

async function getMeetingBookingForTask(taskId: string) {
  const [booking] = await db
    .select()
    .from(calBookingTable)
    .where(eq(calBookingTable.taskId, taskId))
    .limit(1);

  return booking ?? null;
}

async function createMeetingBooking({
  taskId,
  title,
  schedulingUrl,
  createdBy,
}: {
  taskId: string;
  title?: string | null;
  schedulingUrl: string;
  createdBy: string;
}) {
  const [task] = await db
    .select({ id: taskTable.id, projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  const [existing] = await db
    .select({ id: calBookingTable.id })
    .from(calBookingTable)
    .where(eq(calBookingTable.taskId, taskId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(calBookingTable)
      .set({
        schedulingUrl,
        title: title?.trim() || null,
        status: "pending",
        calBookingUid: createId(),
      })
      .where(eq(calBookingTable.id, existing.id))
      .returning();

    return updated;
  }

  const calBase = process.env.CALCOM_URL?.trim();
  const meetingUrl = calBase
    ? `${calBase.replace(/\/$/, "")}/book/${createId()}`
    : schedulingUrl;

  const [created] = await db
    .insert(calBookingTable)
    .values({
      taskId,
      title: title?.trim() || null,
      schedulingUrl,
      meetingUrl,
      calBookingUid: createId(),
      status: "pending",
      createdBy,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, {
      message: "Failed to create meeting booking",
    });
  }

  return created;
}

export { createMeetingBooking, getMeetingBookingForTask };
