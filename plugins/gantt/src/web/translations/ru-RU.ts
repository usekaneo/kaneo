import type { Messages } from "./en-US.js";

export const ruRU = {
  view: {
    title: "Гант",
  },
  status: {
    planned: "Запланировано",
  },
  title: "Временная шкала Ганта",
  jumpToToday: "Jump to today",
  hideTasks: "Скрыть задачи",
  showTasks: "Показать задачи",
  noTasks: "Нет запланированных задач",
  noTasksSubtitle:
    "Добавьте дату начала, срок выполнения или оба значения к задачам, чтобы разместить их на временной шкале проекта.",
  noTasksFound: "Задачи не найдены",
  noMatches: "Нет задач, подходящих под поиск или фильтры.",
  taskHeader: "Задача",
  updateDatesError: "Не удалось обновить даты задачи",
  resizeStart: "Изменить дату начала",
  resizeDue: "Изменить срок выполнения",
  taskAriaLabel: "{{title}}: откройте или перетащите для перемещения",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
