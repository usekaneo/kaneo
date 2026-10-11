import type { Messages } from "./en-US.js";

export const esES = {
  view: {
    title: "Gantt",
  },
  status: {
    planned: "Planeado",
  },
  title: "Diagrama de Gantt",
  jumpToToday: "Jump to today",
  searchPlaceholder: "Buscar tickets planificados...",
  hideTasks: "Esconder tareas",
  showTasks: "Mostrar tareas",
  noTasks: "No hay tareas planificadas",
  noTasksSubtitle:
    "Añade una fecha de comienzo, fecha de vencimiento o ambas para a las tareas para mostrarlas en la línea temporal del proyecto.",
  noTasksFound: "No se han encontrado tareas",
  noTasksMatch: 'Ninguna tarea encaja con "{{query}}"',
  taskHeader: "Tarea",
  updateDatesError: "Error al actualizar las fechas de la tarea",
  resizeStart: "Cambiar la fecha de comienzo",
  resizeDue: "Cambiar la fecha de vencimiento",
  taskAriaLabel: "{{title}}: abrir o arrastrar para mover",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
