import type { Messages } from "./en-US.js";

export const frFR = {
  view: {
    title: "Gantt",
  },
  status: {
    planned: "Planifié",
  },
  title: "Chronologie de Gantt",
  jumpToToday: "Jump to today",
  searchPlaceholder: "Rechercher des tâches planifiées...",
  hideTasks: "Masquer les tâches",
  showTasks: "Afficher les tâches",
  noTasks: "Aucune tâche planifiée",
  noTasksSubtitle:
    "Ajoutez une date de début, une date d'échéance ou les deux pour placer les tâches dans la chronologie du projet.",
  noTasksFound: "Aucune tâche trouvée",
  noTasksMatch: 'Aucune tâche planifiée ne correspond à "{{query}}"',
  taskHeader: "Tâche",
  updateDatesError: "Échec de la mise à jour des dates de la tâche",
  resizeStart: "Redimensionner la date de début",
  resizeDue: "Redimensionner la date d'échéance",
  taskAriaLabel: "{{title}} : ouvrir ou déplacer",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
