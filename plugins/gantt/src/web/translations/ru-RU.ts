import type { Messages } from "./en-US.js";

export const ruRU = {
  view: {
    title: "Гант",
  },
  status: {
    planned: "Запланировано",
  },
  title: "Временная шкала Ганта",
  jumpToToday: "Перейти к сегодняшнему дню",
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
  previousPeriod: "Предыдущий период",
  nextPeriod: "Следующий период",
  periodStart: "Дата начала таймлайна",
  showTaskDates: "Показывать даты задач",
} satisfies Messages;
