import type { Messages } from "./en-US.js";

export const trTR = {
  view: {
    title: "Gantt",
  },
  status: {
    planned: "Planlandı",
  },
  title: "Gantt Zaman Çizelgesi",
  jumpToToday: "Jump to today",
  searchPlaceholder: "Zamanlanmış talep ara...",
  hideTasks: "Talepleri gizle",
  showTasks: "Talepleri göster",
  noTasks: "Zamanlanmış talep yok",
  noTasksSubtitle:
    "Talepleri proje zaman çizelgesine yerleştirmek için başlangıç tarihi, bitiş tarihi veya her ikisini ekleyin.",
  noTasksFound: "Talep bulunamadı",
  noTasksMatch: '"{{query}}" ile eşleşen zamanlanmış talep yok',
  taskHeader: "Talep",
  updateDatesError: "Talep tarihleri güncellenemedi",
  resizeStart: "Başlangıç tarihini yeniden boyutlandır",
  resizeDue: "Bitiş tarihini yeniden boyutlandır",
  taskAriaLabel: "{{title}}: açmak veya taşımak için sürükleyin",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
