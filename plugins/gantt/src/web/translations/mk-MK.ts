import type { Messages } from "./en-US.js";

export const mkMK = {
  view: {
    title: "Gantt",
  },
  status: {
    planned: "Планирано",
  },
  title: "Gantt временска линија",
  jumpToToday: "Jump to today",
  hideTasks: "Сокриј задачи",
  showTasks: "Прикажи задачи",
  noTasks: "Нема закажани задачи",
  noTasksSubtitle:
    "Додади почетен датум, краен рок, или двете на задачите за да ги поставиш на временската линија на проектот.",
  noTasksFound: "Не се пронајдени задачи",
  noMatches: "Ниту една задача не одговара на пребарувањето или филтрите.",
  taskHeader: "Задача",
  updateDatesError: "Неуспешно ажурирање на датуми на задача",
  resizeStart: "Промени почетен датум",
  resizeDue: "Промени краен рок",
  taskAriaLabel: "{{title}}: отвори или повлечи за преместување",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
