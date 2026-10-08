import type { Messages } from "./en-US.js";

export const ukUA = {
  view: {
    title: "Ґант",
  },
  status: {
    planned: "Заплановано",
  },
  title: "Часова шкала Ґанта",
  jumpToToday: "Jump to today",
  searchPlaceholder: "Пошук запланованих тікетів...",
  hideTasks: "Сховати завдання",
  showTasks: "Показати завдання",
  noTasks: "Немає запланованих завдань",
  noTasksSubtitle:
    "Додайте дату початку, дату завершення або обидві до завдань, щоб розмістити їх на часовій шкалі проєкту.",
  noTasksFound: "Завдання не знайдено",
  noTasksMatch: "Жодне заплановане завдання не відповідає «{{query}}»",
  taskHeader: "Завдання",
  updateDatesError: "Не вдалося оновити дати завдання",
  resizeStart: "Змінити дату початку",
  resizeDue: "Змінити дату завершення",
  taskAriaLabel: "{{title}}: відкрити або перетягнути для переміщення",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
