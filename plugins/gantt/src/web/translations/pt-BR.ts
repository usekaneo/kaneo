import type { Messages } from "./en-US.js";

export const ptBR = {
  view: {
    title: "Gantt",
  },
  status: {
    planned: "Planejado",
  },
  title: "Linha do tempo Gantt",
  jumpToToday: "Jump to today",
  searchPlaceholder: "Buscar tickets agendados...",
  hideTasks: "Ocultar tarefas",
  showTasks: "Mostrar tarefas",
  noTasks: "Nenhuma tarefa agendada",
  noTasksSubtitle:
    "Adicione uma data de início, data de vencimento ou ambas às tarefas para posicioná-las na linha do tempo do projeto.",
  noTasksFound: "Nenhuma tarefa encontrada",
  noTasksMatch: 'Nenhuma tarefa agendada corresponde a "{{query}}"',
  taskHeader: "Tarefa",
  updateDatesError: "Falha ao atualizar as datas da tarefa",
  resizeStart: "Redimensionar data de início",
  resizeDue: "Redimensionar data de vencimento",
  taskAriaLabel: "{{title}}: abrir ou arrastar para mover",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
