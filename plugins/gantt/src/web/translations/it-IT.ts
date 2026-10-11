import type { Messages } from "./en-US.js";

export const itIT = {
  view: {
    title: "Gantt",
  },
  status: {
    planned: "Pianificato",
  },
  title: "Cronologia Gantt",
  jumpToToday: "Jump to today",
  searchPlaceholder: "Cerca ticket programmati...",
  hideTasks: "Nascondi attività",
  showTasks: "Mostra attività",
  noTasks: "Nessuna attività programmata",
  noTasksSubtitle:
    "Aggiungi una data di inizio, scadenza, o entrambe alle attività per posizionarle sulla cronologia del progetto.",
  noTasksFound: "Nessuna attività trovata",
  noTasksMatch: 'Nessuna attività programmata corrisponde a "{{query}}"',
  taskHeader: "Attività",
  updateDatesError: "Aggiornamento date attività fallito",
  resizeStart: "Ridimensiona data inizio",
  resizeDue: "Ridimensiona data scadenza",
  taskAriaLabel: "{{title}}: apri o trascina per spostare",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
