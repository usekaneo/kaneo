import type { Messages } from "./en-US.js";

export const deDE = {
  view: {
    title: "Gantt",
  },
  status: {
    planned: "Geplant",
  },
  title: "Gantt-Zeitachse",
  jumpToToday: "Zu heute springen",
  searchPlaceholder: "Geplante Tickets suchen...",
  hideTasks: "Aufgaben ausblenden",
  showTasks: "Aufgaben anzeigen",
  noTasks: "Keine geplanten Aufgaben",
  noTasksSubtitle:
    "Füge Aufgaben ein Startdatum, ein Fälligkeitsdatum oder beides hinzu, um sie auf der Projektzeitleiste zu platzieren.",
  noTasksFound: "Keine Aufgaben gefunden",
  noTasksMatch: 'Keine geplanten Aufgaben entsprechen "{{query}}"',
  taskHeader: "Aufgabe",
  updateDatesError: "Aufgabendaten konnten nicht aktualisiert werden",
  resizeStart: "Startdatum anpassen",
  resizeDue: "Fälligkeitsdatum anpassen",
  taskAriaLabel: "{{title}}: öffnen oder ziehen zum Verschieben",
  previousPeriod: "Vorheriger Zeitraum",
  nextPeriod: "Nächster Zeitraum",
  periodStart: "Startdatum der Zeitleiste",
  showTaskDates: "Aufgabendaten anzeigen",
} satisfies Messages;
