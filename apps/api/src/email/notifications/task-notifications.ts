import { eq } from "drizzle-orm";
import db from "../../database";
import { projectTable, userTable } from "../../database/schema";
import { subscribeToEvent } from "../../events";
import { emailService } from "../email-service";
import {
  generateTaskAssignedEmail,
  generateTaskCommentAddedEmail,
  generateTaskStatusChangedEmail,
  generateTimeTrackingStartedEmail,
} from "../mjml/mjml-generator";

export interface TaskAssignedEventData {
  taskId: string;
  userId: string;
  title: string;
  description?: string;
  priority?: string;
  dueDate?: Date;
  projectId: string;
}

export interface TaskStatusChangedEventData {
  taskId: string;
  userId?: string;
  oldStatus: string;
  newStatus: string;
  title: string;
}

export interface TaskAssigneeChangedEventData {
  taskId: string;
  newAssignee?: string;
  title: string;
}

export interface TaskCommentAddedEventData {
  taskId: string;
  commenterId: string;
  content: string;
}

export interface TimeTrackingStartedEventData {
  timeEntryId: string;
  taskId: string;
  userId: string;
  type: string;
  content: string;
}

export class TaskEmailNotificationService {
  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    subscribeToEvent<TaskAssignedEventData>("task.created", async (data) => {
      if (data.userId) {
        await this.sendTaskAssignedEmail(data);
      }
    });

    subscribeToEvent<TaskStatusChangedEventData>(
      "task.status_changed",
      async (data) => {
        if (data.userId) {
          await this.sendTaskStatusChangedEmail(data);
        }
      }
    );

    subscribeToEvent<TaskAssigneeChangedEventData>(
      "task.assignee_changed",
      async (data) => {
        if (data.newAssignee) {
          await this.sendTaskAssignedEmail({
            taskId: data.taskId,
            userId: data.newAssignee,
            title: data.title,
            projectId: "",
          });
        }
      }
    );

    subscribeToEvent<TaskCommentAddedEventData>(
      "task.comment_added",
      async (data) => {
        await this.sendTaskCommentAddedEmail(data);
      }
    );

    subscribeToEvent<TimeTrackingStartedEventData>(
      "time-entry.created",
      async (data) => {
        await this.sendTimeTrackingStartedEmail(data);
      }
    );
  }

  private async sendTaskAssignedEmail(data: TaskAssignedEventData) {
    try {
      if (!emailService.isAvailable()) {
        console.log(
          "Email service not available, skipping task assignment notification"
        );
        return;
      }

      const [assignee] = await db
        .select({ name: userTable.name, email: userTable.email })
        .from(userTable)
        .where(eq(userTable.id, data.userId));

      if (!assignee || !assignee.email) {
        console.log(`No email found for user ${data.userId}`);
        return;
      }

      let projectName = "Project";
      if (data.projectId) {
        const [project] = await db
          .select({ name: projectTable.name })
          .from(projectTable)
          .where(eq(projectTable.id, data.projectId));

        if (project) {
          projectName = project.name;
        }
      }

      if (!data.projectId) {
        const taskQuery = await db.query.taskTable.findFirst({
          where: (task, { eq }) => eq(task.id, data.taskId),
          with: {
            project: {
              columns: { name: true, id: true, workspaceId: true },
            },
          },
        });

        if (taskQuery?.project) {
          projectName = taskQuery.project.name;
          data.projectId = taskQuery.project.id;
        }
      }

      const projectInfo = await db.query.projectTable.findFirst({
        where: (project, { eq }) => eq(project.id, data.projectId),
        columns: { id: true, name: true, workspaceId: true },
      });

      if (projectInfo) {
        projectName = projectInfo.name;
      }

      const baseUrl = process.env.FRONTEND_URL;
      const taskUrl = projectInfo
        ? `${baseUrl}/dashboard/workspace/${projectInfo.workspaceId}/project/${data.projectId}/task/${data.taskId}`
        : `${baseUrl}/project/${data.projectId}/task/${data.taskId}`;

      const emailContent = generateTaskAssignedEmail({
        taskTitle: data.title,
        taskDescription: data.description,
        assigneeName: assignee.name,
        projectName,
        taskUrl,
        dueDate: data.dueDate,
        priority: data.priority,
      });

      await emailService.sendEmail({
        to: assignee.email,
        subject: `New task assigned: ${data.title}`,
        html: emailContent.html,
        text: emailContent.text,
      });

      console.log(
        `Task assignment email sent to ${assignee.email} for task ${data.taskId}`
      );
    } catch (error) {
      console.error("Error sending task assignment email:", error);
    }
  }

  private async sendTaskStatusChangedEmail(data: TaskStatusChangedEventData) {
    try {
      if (!emailService.isAvailable()) {
        console.log(
          "Email service not available, skipping task status change notification"
        );
        return;
      }

      if (!data.userId) {
        console.log(
          "No user assigned to task, skipping status change notification"
        );
        return;
      }

      const [assignee] = await db
        .select({ name: userTable.name, email: userTable.email })
        .from(userTable)
        .where(eq(userTable.id, data.userId));

      if (!assignee || !assignee.email) {
        console.log(`No email found for user ${data.userId}`);
        return;
      }

      const taskQuery = await db.query.taskTable.findFirst({
        where: (task, { eq }) => eq(task.id, data.taskId),
        with: {
          project: {
            columns: { name: true, id: true, workspaceId: true },
          },
        },
      });

      if (!taskQuery?.project) {
        console.log(`No project found for task ${data.taskId}`);
        return;
      }

      const baseUrl = process.env.FRONTEND_URL;
      const taskUrl = `${baseUrl}/dashboard/workspace/${taskQuery.project.workspaceId}/project/${taskQuery.project.id}/task/${data.taskId}`;

      const emailContent = generateTaskStatusChangedEmail({
        taskTitle: data.title,
        assigneeName: assignee.name,
        projectName: taskQuery.project.name,
        taskUrl,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
      });

      await emailService.sendEmail({
        to: assignee.email,
        subject: `Status updated: ${data.title}`,
        html: emailContent.html,
        text: emailContent.text,
      });

      console.log(
        `Task status change email sent to ${assignee.email} for task ${data.taskId}`
      );
    } catch (error) {
      console.error("Error sending task status change email:", error);
    }
  }

  private async sendTaskCommentAddedEmail(data: TaskCommentAddedEventData) {
    try {
      if (!emailService.isAvailable()) {
        console.log(
          "Email service not available, skipping comment notification"
        );
        return;
      }

      const taskQuery = await db.query.taskTable.findFirst({
        where: (task, { eq }) => eq(task.id, data.taskId),
        with: {
          project: {
            columns: { name: true, id: true, workspaceId: true },
          },
        },
        columns: { title: true, userId: true },
      });

      if (!taskQuery || !taskQuery.userId) {
        console.log(`No assigned user found for task ${data.taskId}`);
        return;
      }

      if (taskQuery.userId === data.commenterId) {
        console.log(
          "Comment author is the same as assignee, skipping notification"
        );
        return;
      }

      const [assignee] = await db
        .select({ name: userTable.name, email: userTable.email })
        .from(userTable)
        .where(eq(userTable.id, taskQuery.userId));

      if (!assignee || !assignee.email) {
        console.log(`No email found for assigned user ${taskQuery.userId}`);
        return;
      }

      const [commenter] = await db
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, data.commenterId));

      if (!commenter) {
        console.log(`No user found for commenter ${data.commenterId}`);
        return;
      }

      const baseUrl = process.env.FRONTEND_URL;
      const taskUrl = taskQuery.project
        ? `${baseUrl}/dashboard/workspace/${taskQuery.project.workspaceId}/project/${taskQuery.project.id}/task/${data.taskId}`
        : `${baseUrl}/task/${data.taskId}`;

      const emailContent = generateTaskCommentAddedEmail({
        taskTitle: taskQuery.title,
        taskUrl,
        assigneeName: assignee.name,
        commenterName: commenter.name,
        commentContent: data.content,
        projectName: taskQuery.project?.name || "Unknown Project",
      });

      await emailService.sendEmail({
        to: assignee.email,
        subject: `New comment on: ${taskQuery.title}`,
        html: emailContent.html,
        text: emailContent.text,
      });

      console.log(
        `Comment notification email sent to ${assignee.email} for task ${data.taskId}`
      );
    } catch (error) {
      console.error("Error sending comment notification email:", error);
    }
  }

  private async sendTimeTrackingStartedEmail(
    data: TimeTrackingStartedEventData
  ) {
    try {
      if (!emailService.isAvailable()) {
        console.log(
          "Email service not available, skipping time tracking notification"
        );
        return;
      }

      const timeEntry = await db.query.timeEntryTable.findFirst({
        where: (entry, { eq }) => eq(entry.id, data.timeEntryId),
        columns: { startTime: true, description: true },
      });

      if (!timeEntry) {
        console.log(`Time entry not found: ${data.timeEntryId}`);
        return;
      }

      const taskQuery = await db.query.taskTable.findFirst({
        where: (task, { eq }) => eq(task.id, data.taskId),
        with: {
          project: {
            columns: { name: true, id: true, workspaceId: true },
          },
        },
        columns: { title: true, userId: true },
      });

      if (!taskQuery || !taskQuery.userId) {
        console.log(`No assigned user found for task ${data.taskId}`);
        return;
      }

      if (taskQuery.userId === data.userId) {
        console.log(
          "Time tracker is the same as assignee, skipping notification"
        );
        return;
      }

      const [assignee] = await db
        .select({ name: userTable.name, email: userTable.email })
        .from(userTable)
        .where(eq(userTable.id, taskQuery.userId));

      if (!assignee || !assignee.email) {
        console.log(`No email found for assigned user ${taskQuery.userId}`);
        return;
      }

      const [tracker] = await db
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, data.userId));

      if (!tracker) {
        console.log(`No user found for tracker ${data.userId}`);
        return;
      }

      const baseUrl = process.env.FRONTEND_URL;
      const taskUrl = taskQuery.project
        ? `${baseUrl}/dashboard/workspace/${taskQuery.project.workspaceId}/project/${taskQuery.project.id}/task/${data.taskId}`
        : `${baseUrl}/task/${data.taskId}`;

      const emailContent = generateTimeTrackingStartedEmail({
        taskTitle: taskQuery.title,
        taskUrl,
        assigneeName: assignee.name,
        trackerName: tracker.name,
        projectName: taskQuery.project?.name || "Unknown Project",
        startTime: timeEntry.startTime,
        description: timeEntry.description || undefined,
      });

      await emailService.sendEmail({
        to: assignee.email,
        subject: `Time tracking started on: ${taskQuery.title}`,
        html: emailContent.html,
        text: emailContent.text,
      });

      console.log(
        `Time tracking notification email sent to ${assignee.email} for task ${data.taskId}`
      );
    } catch (error) {
      console.error("Error sending time tracking notification email:", error);
    }
  }
}

export const taskEmailNotificationService = new TaskEmailNotificationService();
