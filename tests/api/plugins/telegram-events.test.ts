import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  handleTaskAssigneeChanged,
  handleTaskCommentCreated,
  handleTaskCreated,
  handleTaskDescriptionChanged,
  handleTaskPriorityChanged,
  handleTaskStatusChanged,
  handleTaskTitleChanged,
} from "../../../apps/api/src/plugins/telegram/events";

const m = vi.hoisted(() => ({
  getEventData: vi.fn(),
  send: vi.fn(),
}));

vi.mock("../../../apps/api/src/plugins/telegram/event-data", () => ({
  getTelegramEventData: m.getEventData,
}));
vi.mock("../../../apps/api/src/plugins/telegram/client", () => ({
  postToTelegram: m.send,
}));

const token = `12345678:${"x".repeat(35)}`;
const context = {
  integrationId: "integration",
  projectId: "project",
  config: {
    botToken: token,
    chatId: "-100123",
    events: {
      taskCreated: true,
      taskStatusChanged: true,
      taskPriorityChanged: true,
      taskTitleChanged: true,
      taskDescriptionChanged: true,
      taskCommentCreated: true,
      taskAssigneeChanged: true,
    },
  },
};
const data = {
  taskTitle: "Task",
  taskNumber: 1,
  projectName: "Project",
  taskUrl: null,
  actorName: "Creator",
  status: "to-do",
  priority: null,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("Telegram handler targets", () => {
  it("uses the creator as actor and the assignee as the mention target", async () => {
    m.getEventData.mockResolvedValue({
      ...data,
      assignee: { name: "Alex", telegramHandle: "alex" },
    });

    await handleTaskCreated(
      {
        taskId: "task",
        projectId: "project",
        userId: "assignee",
        actorId: "creator",
        title: "Task",
        description: null,
        priority: null,
        status: "to-do",
        number: 1,
      },
      context,
    );

    expect(m.getEventData).toHaveBeenCalledWith(
      "task",
      "project",
      "creator",
      "assignee",
    );
    expect(m.send.mock.calls[0][1].text).toContain("<b>Assignee:</b> @alex");
  });

  it("renders a numeric assignee as an inline link", async () => {
    m.getEventData.mockResolvedValue({
      ...data,
      assignee: { name: "Alex", telegramHandle: "123456789" },
    });

    await handleTaskCreated(
      {
        taskId: "task",
        projectId: "project",
        userId: "assignee",
        actorId: "creator",
        title: "Task",
        description: null,
        priority: null,
        status: "to-do",
        number: 1,
      },
      context,
    );

    expect(m.send.mock.calls[0][1].text).toContain(
      '<b>Assignee:</b> <a href="tg://user?id=123456789">Alex</a>',
    );
  });

  it.each([
    [
      "status",
      () =>
        handleTaskStatusChanged(
          {
            taskId: "task",
            projectId: "project",
            userId: "actor",
            oldStatus: "to-do",
            newStatus: "done",
            title: "Task",
          },
          context,
        ),
    ],
    [
      "priority",
      () =>
        handleTaskPriorityChanged(
          {
            taskId: "task",
            projectId: "project",
            userId: "actor",
            oldPriority: "low",
            newPriority: "high",
            title: "Task",
          },
          context,
        ),
    ],
    [
      "title",
      () =>
        handleTaskTitleChanged(
          {
            taskId: "task",
            projectId: "project",
            userId: "actor",
            oldTitle: "Old",
            newTitle: "New",
          },
          context,
        ),
    ],
    [
      "description",
      () =>
        handleTaskDescriptionChanged(
          {
            taskId: "task",
            projectId: "project",
            userId: "actor",
            oldDescription: null,
            newDescription: "New",
          },
          context,
        ),
    ],
    [
      "comment",
      () =>
        handleTaskCommentCreated(
          {
            taskId: "task",
            projectId: "project",
            userId: "actor",
            comment: "Hello",
          },
          context,
        ),
    ],
  ])("keeps the current format for %s events", async (_name, run) => {
    m.getEventData.mockResolvedValue({ ...data, assignee: null });

    await run();

    expect(m.getEventData).toHaveBeenCalledWith(
      "task",
      "project",
      "actor",
      null,
    );
    expect(m.send.mock.calls[0][1].text).not.toContain("<b>Assignee:</b>");
  });

  it("mentions the event-time new assignee", async () => {
    m.getEventData.mockResolvedValue({
      ...data,
      assignee: { name: "New", telegramHandle: "new" },
    });

    await handleTaskAssigneeChanged(
      {
        taskId: "task",
        projectId: "project",
        userId: "actor",
        title: "Task",
        oldAssignee: "Old",
        newAssignee: "New",
        newAssigneeId: "new",
      },
      context,
    );

    expect(m.getEventData).toHaveBeenCalledWith(
      "task",
      "project",
      "actor",
      "new",
    );
    expect(m.send.mock.calls[0][1].text).toContain("Task was assigned to New.");
  });

  it("treats an unassigned create as no assignee", async () => {
    m.getEventData.mockResolvedValue({ ...data, assignee: null });

    await handleTaskCreated(
      {
        taskId: "task",
        projectId: "project",
        userId: "",
        actorId: "creator",
        title: "Task",
        description: null,
        priority: null,
        status: "to-do",
        number: 1,
      },
      context,
    );

    expect(m.getEventData).toHaveBeenCalledWith(
      "task",
      "project",
      "creator",
      null,
    );
  });
});
