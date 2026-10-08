import type { Messages } from "./en-US.js";

export const nlNL = {
  view: {
    title: "Gantt",
  },
  status: {
    planned: "Gepland",
  },
  title: "Gantt-tijdlijn",
  jumpToToday: "Jump to today",
  searchPlaceholder: "Zoek geplande tickets...",
  hideTasks: "Taken verbergen",
  showTasks: "Taken tonen",
  noTasks: "Geen geplande taken",
  noTasksSubtitle:
    "Voeg een startdatum en/of einddatum toe aan taken om ze op de tijdlijn te plaatsen.",
  noTasksFound: "Geen taken gevonden",
  noTasksMatch: 'Geen geplande taken die overeenkomen met "{{query}}"',
  taskHeader: "Taak",
  updateDatesError: "Bijwerken taakdatums mislukt",
  resizeStart: "Startdatum wijzigen",
  resizeDue: "Einddatum wijzigen",
  taskAriaLabel: "{{title}}: openen of slepen om te verplaatsen",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
