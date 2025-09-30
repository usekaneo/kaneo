import { StreamableHTTPTransport } from "@hono/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
import { z } from "zod/v3";

import createProject from "../project/controllers/create-project";
import deleteProject from "../project/controllers/delete-project";
import getProject from "../project/controllers/get-project";
// Import existing controllers
import getProjects from "../project/controllers/get-projects";
import updateProject from "../project/controllers/update-project";

import createTask from "../task/controllers/create-task";
import deleteTask from "../task/controllers/delete-task";
import getTask from "../task/controllers/get-task";
import getTasks from "../task/controllers/get-tasks";
import updateTask from "../task/controllers/update-task";
import updateTaskAssignee from "../task/controllers/update-task-assignee";
import updateTaskDueDate from "../task/controllers/update-task-due-date";
import updateTaskPriority from "../task/controllers/update-task-priority";
import updateTaskStatus from "../task/controllers/update-task-status";

import createActivity from "../activity/controllers/create-activity";
import getActivities from "../activity/controllers/get-activities";

import createTimeEntry from "../time-entry/controllers/create-time-entry";
import getTimeEntries from "../time-entry/controllers/get-time-entries";
import updateTimeEntry from "../time-entry/controllers/update-time-entry";

import getNotifications from "../notification/controllers/get-notifications";
import markNotificationAsRead from "../notification/controllers/mark-notification-as-read";

import globalSearch from "../search/controllers/global-search";

import { and, eq, gte, lte } from "drizzle-orm";
import db from "../database";
import { projectTable, taskTable } from "../database/schema";

const mcp = new Hono();

const server = new McpServer({
  name: "Kaneo MCP Server",
  version: "1.0.0",
});

// Project Management Tools
server.registerTool(
  "get_projects",
  {
    title: "Get Projects",
    description: "Get all projects for a workspace with statistics",
    inputSchema: {
      workspaceId: z.string().describe("The workspace ID to get projects for"),
    },
  },
  async ({ workspaceId }) => {
    try {
      const projects = await getProjects(workspaceId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(projects, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting projects: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "get_project",
  {
    title: "Get Project",
    description: "Get a specific project by ID",
    inputSchema: {
      projectId: z.string().describe("The project ID to retrieve"),
      workspaceId: z.string().describe("The workspace ID"),
    },
  },
  async ({ projectId, workspaceId }) => {
    try {
      const project = await getProject(projectId, workspaceId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(project, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting project: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "create_project",
  {
    title: "Create Project",
    description: "Create a new project",
    inputSchema: {
      workspaceId: z.string().describe("The workspace ID"),
      name: z.string().describe("Project name"),
      icon: z.string().optional().describe("Project icon"),
      slug: z.string().describe("Project slug"),
    },
  },
  async ({ workspaceId, name, icon, slug }) => {
    try {
      const project = await createProject(
        workspaceId,
        name,
        icon || "Layout",
        slug,
      );
      return {
        content: [
          {
            type: "text",
            text: `Project created successfully: ${JSON.stringify(project, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating project: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "update_project",
  {
    title: "Update Project",
    description: "Update existing project",
    inputSchema: {
      projectId: z.string().describe("The project ID to update"),
      name: z.string().describe("Project name"),
      description: z.string().optional().describe("Project description"),
      icon: z.string().optional().describe("Project icon"),
      slug: z.string().describe("Project slug"),
      isPublic: z.boolean().describe("Should the project be public"),
    },
  },
  async ({ projectId, name, description, icon, slug, isPublic }) => {
    try {
      const project = await updateProject(
        projectId,
        name,
        icon || "Layout",
        slug,
        description || "",
        isPublic || true,
      );
      return {
        content: [
          {
            type: "text",
            text: `Project updated successfully: ${JSON.stringify(project, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating project: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "delete_project",
  {
    title: "Delete Project",
    description: "Delete existing project",
    inputSchema: {
      projectId: z.string().describe("The project ID to delete"),
    },
  },
  async ({ projectId }) => {
    try {
      await deleteProject(projectId);
      return {
        content: [
          {
            type: "text",
            text: "Project deleted successfully",
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting project: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

// Task Management Tools
server.registerTool(
  "get_tasks",
  {
    title: "Get Tasks",
    description: "Get all tasks for a project organized by columns",
    inputSchema: {
      projectId: z.string().describe("The project ID to get tasks for"),
    },
  },
  async ({ projectId }) => {
    try {
      const tasks = await getTasks(projectId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tasks, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting tasks: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "get_task",
  {
    title: "Get Tasks",
    description: "Get a task",
    inputSchema: {
      taskId: z.string().describe("The task ID to get"),
    },
  },
  async ({ taskId }) => {
    try {
      const task = await getTask(taskId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(task, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting task: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "get_tasks_by_date",
  {
    title: "Get Tasks by Date",
    description: "Get tasks filtered by date range and optionally by priority",
    inputSchema: {
      startDate: z.string().describe("Start date in ISO format (YYYY-MM-DD)"),
      endDate: z.string().describe("End date in ISO format (YYYY-MM-DD)"),
      priority: z
        .enum(["low", "medium", "high", "urgent"])
        .optional()
        .describe("Filter by priority"),
      status: z.string().optional().describe("Filter by status"),
      assigneeId: z.string().optional().describe("Filter by assignee ID"),
    },
  },
  async ({ startDate, endDate, priority, status, assigneeId }) => {
    try {
      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999); // End of day

      const whereConditions = [
        and(
          gte(taskTable.dueDate, startDateTime),
          lte(taskTable.dueDate, endDateTime),
        ),
      ];

      if (priority) {
        whereConditions.push(eq(taskTable.priority, priority));
      }
      if (status) {
        whereConditions.push(eq(taskTable.status, status));
      }
      if (assigneeId) {
        whereConditions.push(eq(taskTable.userId, assigneeId));
      }

      const tasks = await db.query.taskTable.findMany({
        where: and(...whereConditions),
        with: {
          project: true,
          assignee: true,
          labels: true,
        },
        orderBy: (tasks, { asc }) => [asc(tasks.dueDate)],
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tasks, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting tasks by date: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "get_today_tasks",
  {
    title: "Get Today's Tasks",
    description: "Get all tasks due today, sorted by priority",
    inputSchema: {
      assigneeId: z.string().optional().describe("Filter by assignee ID"),
    },
  },
  async ({ assigneeId }) => {
    try {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        23,
        59,
        59,
        999,
      );

      const whereConditions = [
        and(
          gte(taskTable.dueDate, startOfDay),
          lte(taskTable.dueDate, endOfDay),
        ),
      ];

      if (assigneeId) {
        whereConditions.push(eq(taskTable.userId, assigneeId));
      }

      const tasks = await db.query.taskTable.findMany({
        where: and(...whereConditions),
        with: {
          project: true,
          assignee: true,
          labels: true,
        },
        orderBy: (tasks, { asc }) => [asc(tasks.dueDate)],
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                date: today.toISOString().split("T")[0],
                totalTasks: tasks.length,
                tasks: tasks,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting today's tasks: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "create_task",
  {
    title: "Create Task",
    description: "Create a new task in a project",
    inputSchema: {
      projectId: z.string().describe("The project ID"),
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      priority: z
        .enum(["low", "medium", "high", "urgent"])
        .optional()
        .describe("Task priority"),
      status: z.string().optional().describe("Task status"),
      assigneeId: z.string().optional().describe("Assignee user ID"),
      dueDate: z.string().optional().describe("Due date in ISO format"),
    },
  },
  async ({
    projectId,
    title,
    description,
    priority,
    status,
    assigneeId,
    dueDate,
  }) => {
    try {
      const taskData = {
        projectId,
        title,
        description,
        priority: priority || "low",
        status: status || "to-do",
        userId: assigneeId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      };
      const task = await createTask(taskData);
      return {
        content: [
          {
            type: "text",
            text: `Task created successfully: ${JSON.stringify(task, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating task: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "update_task",
  {
    title: "Update Task",
    description: "Update task in a project",
    inputSchema: {
      projectId: z.string().describe("The project ID"),
      taskId: z.string().describe("The task ID"),
      title: z.string().describe("Task title"),
      description: z.string().describe("Task description"),
      priority: z
        .enum(["low", "medium", "high", "urgent"])
        .optional()
        .describe("Task priority"),
      status: z.string().optional().describe("Task status"),
      assigneeId: z.string().optional().describe("Assignee user ID"),
      dueDate: z.string().describe("Due date in ISO format"),
    },
  },
  async ({
    projectId,
    taskId,
    title,
    description,
    priority,
    status,
    assigneeId,
    dueDate,
  }) => {
    try {
      const task = await updateTask(
        taskId,
        title,
        status || "to-do",
        new Date(dueDate),
        projectId,
        description,
        priority || "low",
        0,
        assigneeId,
      );
      return {
        content: [
          {
            type: "text",
            text: `Task updated successfully: ${JSON.stringify(task, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating task: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "update_task_status",
  {
    title: "Update Task Status",
    description: "Update the status of a task",
    inputSchema: {
      taskId: z.string().describe("The task ID"),
      status: z.string().describe("New status"),
    },
  },
  async ({ taskId, status }) => {
    try {
      const task = await updateTaskStatus({ id: taskId, status });
      return {
        content: [
          {
            type: "text",
            text: `Task status updated successfully: ${JSON.stringify(task, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating task status: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "update_task_assignee",
  {
    title: "Update Task Assignee",
    description: "Update the assignee of a task",
    inputSchema: {
      taskId: z.string().describe("The task ID"),
      assigneeId: z.string().describe("New assignee user ID"),
    },
  },
  async ({ taskId, assigneeId }) => {
    try {
      const task = await updateTaskAssignee({ id: taskId, userId: assigneeId });
      return {
        content: [
          {
            type: "text",
            text: `Task assignee updated successfully: ${JSON.stringify(task, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating task assignee: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "update_task_priority",
  {
    title: "Update Task Priority",
    description: "Update the priority of a task",
    inputSchema: {
      taskId: z.string().describe("The task ID"),
      priority: z
        .enum(["low", "medium", "high", "urgent"])
        .describe("New priority"),
    },
  },
  async ({ taskId, priority }) => {
    try {
      const task = await updateTaskPriority({ id: taskId, priority });
      return {
        content: [
          {
            type: "text",
            text: `Task priority updated successfully: ${JSON.stringify(task, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating task priority: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "update_task_due_date",
  {
    title: "Update Task Due Date",
    description: "Update the due date of a task",
    inputSchema: {
      taskId: z.string().describe("The task ID"),
      dueDate: z.string().describe("New due date in ISO format"),
    },
  },
  async ({ taskId, dueDate }) => {
    try {
      const task = await updateTaskDueDate({
        id: taskId,
        dueDate: new Date(dueDate),
      });
      return {
        content: [
          {
            type: "text",
            text: `Task due date updated successfully: ${JSON.stringify(task, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating task due date: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

// Search Tools
server.registerTool(
  "global_search",
  {
    title: "Global Search",
    description: "Search across projects, tasks, and other content",
    inputSchema: {
      workspaceId: z.string().describe("The workspace ID"),
      query: z.string().describe("Search query"),
    },
  },
  async ({ workspaceId, query }) => {
    try {
      const results = await globalSearch({
        workspaceId,
        query,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error performing search: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

// Activity and Time Tracking Tools
server.registerTool(
  "get_activities",
  {
    title: "Get Activities",
    description: "Get activities for a task",
    inputSchema: {
      taskId: z.string().describe("The task ID"),
    },
  },
  async ({ taskId }) => {
    try {
      const activities = await getActivities(taskId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(activities, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting activities: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "get_time_entries",
  {
    title: "Get Time Entries",
    description: "Get time entries for a task",
    inputSchema: {
      taskId: z.string().describe("The task ID"),
    },
  },
  async ({ taskId }) => {
    try {
      const timeEntries = await getTimeEntries(taskId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(timeEntries, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting time entries: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "delete_task",
  {
    title: "Delete Task",
    description: "Delete a task",
    inputSchema: {
      taskId: z.string().describe("The task ID"),
    },
  },
  async ({ taskId }) => {
    try {
      const task = await deleteTask(taskId);
      return {
        content: [
          {
            type: "text",
            text: `Task deleted successfully: ${JSON.stringify(task, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting task: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

// Notification Tools
server.registerTool(
  "get_notifications",
  {
    title: "Get Notifications",
    description: "Get notifications for a user",
    inputSchema: {
      userId: z.string().describe("The user ID"),
    },
  },
  async ({ userId }) => {
    try {
      const notifications = await getNotifications(userId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(notifications, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting notifications: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

mcp.all("/", async (c) => {
  const transport = new StreamableHTTPTransport();
  await server.connect(transport);
  return transport.handleRequest(c);
});

export default mcp;
