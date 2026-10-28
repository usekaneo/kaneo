import type { Messages } from "./en-US.js";

export const frFR = {
  view: {
    title: "Gantt",
  },
  status: {
    planned: "Planifié",
  },
  title: "Chronologie de Gantt",
  jumpToToday: "Aller à aujourd'hui",
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
  previousPeriod: "Période précédente",
  nextPeriod: "Période suivante",
  periodStart: "Date de début de la chronologie",
  showTaskDates: "Afficher les dates des tâches",
} satisfies Messages;
