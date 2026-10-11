import type { Messages } from "./en-US.js";

export const plPL = {
  view: {
    title: "Wykres Gantta",
  },
  status: {
    planned: "Zaplanowane",
  },
  title: "Oś czasu Gantta",
  jumpToToday: "Przejdź do dzisiaj",
  searchPlaceholder: "Szukaj zaplanowanych zadań...",
  hideTasks: "Ukryj zadania",
  showTasks: "Pokaż zadania",
  noTasks: "Brak zaplanowanych zadań",
  noTasksSubtitle:
    "Dodaj datę rozpoczęcia, termin lub obie daty, aby umieścić zadania na osi czasu projektu.",
  noTasksFound: "Nie znaleziono zadań",
  noTasksMatch: "Brak zaplanowanych zadań pasujących do „{{query}}”",
  taskHeader: "Zadanie",
  updateDatesError: "Nie udało się zaktualizować dat zadania",
  resizeStart: "Zmień rozmiar daty rozpoczęcia",
  resizeDue: "Zmień rozmiar terminu",
  taskAriaLabel: "{{title}}: otwórz lub przeciągnij, aby przenieść",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
