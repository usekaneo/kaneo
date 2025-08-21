import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import db from "../database";
import { notificationTable } from "../database/schema";
import { publishEvent } from "../events";
import { protectedProcedure, router } from "../lib/trpc";

export const notificationRouter = router({
  // Create a new notification
  create: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        title: z.string(),
        content: z.string().optional(),
        type: z.string().optional(),
        resourceId: z.string().optional(),
        resourceType: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [notification] = await db
        .insert(notificationTable)
        .values({
          userId: input.userId,
          title: input.title,
          content: input.content || "",
          type: input.type || "info",
          resourceId: input.resourceId || null,
          resourceType: input.resourceType || null,
        })
        .returning();

      if (notification) {
        await publishEvent("notification.created", {
          notificationId: notification.id,
          userId: input.userId,
        });
      }

      return notification;
    }),

  // Get notifications for the current user
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().optional().default(50),
      }),
    )
    .query(async ({ input, ctx }) => {
      const notifications = await db
        .select()
        .from(notificationTable)
        .where(eq(notificationTable.userId, ctx.session.user.id))
        .orderBy(desc(notificationTable.createdAt))
        .limit(input.limit);

      return notifications;
    }),

  // Mark a notification as read
  markAsRead: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const [notification] = await db
        .update(notificationTable)
        .set({ isRead: true })
        .where(eq(notificationTable.id, input.id))
        .returning();

      if (!notification) {
        throw new Error("Notification not found");
      }

      return notification;
    }),

  // Mark all notifications as read for the current user
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(notificationTable)
      .set({ isRead: true })
      .where(eq(notificationTable.userId, ctx.session.user.id));
  }),

  // Clear all notifications for the current user
  clear: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .delete(notificationTable)
      .where(eq(notificationTable.userId, ctx.session.user.id));
  }),

  // Get unread count for the current user
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const result = await db
      .select()
      .from(notificationTable)
      .where(
        eq(notificationTable.userId, ctx.session.user.id) &&
          eq(notificationTable.isRead, false),
      );

    return result.length;
  }),
});
