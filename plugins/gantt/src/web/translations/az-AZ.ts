import type { Messages } from "./en-US.js";

export const azAZ = {
  view: {
    title: "Qant diaqramı",
  },
  status: {
    planned: "Planlaşdırılmış",
  },
  title: "Qant zaman xətti",
  jumpToToday: "Bu günə keç",
  searchPlaceholder: "Tarixi təyin edilmiş tapşırıqları axtar...",
  hideTasks: "Tapşırıqları gizlət",
  showTasks: "Tapşırıqları göstər",
  noTasks: "Tarixi təyin edilmiş tapşırıq yoxdur",
  noTasksSubtitle:
    "Tapşırıqları layihənin zaman xəttində yerləşdirmək üçün onlara başlama tarixi, son tarix və ya hər ikisini əlavə edin.",
  noTasksFound: "Tapşırıq tapılmadı",
  noTasksMatch:
    '"{{query}}" sorğusuna uyğun tarixi təyin edilmiş tapşırıq yoxdur',
  taskHeader: "Tapşırıq",
  updateDatesError: "Tapşırıq tarixlərini yeniləmək alınmadı",
  resizeStart: "Başlama tarixini sürüşdür",
  resizeDue: "Son tarixi sürüşdür",
  taskAriaLabel: "{{title}}: aç və ya köçürmək üçün sürüklə",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
