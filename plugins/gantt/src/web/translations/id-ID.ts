import type { Messages } from "./en-US.js";

export const idID = {
  view: {
    title: "Gantt",
  },
  status: {
    planned: "Direncanakan",
  },
  title: "Linimasa Gantt",
  jumpToToday: "Jump to today",
  hideTasks: "Sembunyikan tugas",
  showTasks: "Tampilkan tugas",
  noTasks: "Tidak ada tugas terjadwal",
  noTasksSubtitle:
    "Tambahkan tanggal mulai, tenggat, atau keduanya ke tugas untuk menempatkannya di linimasa proyek.",
  noTasksFound: "Tugas tidak ditemukan",
  noMatches: "Tidak ada tugas yang cocok dengan pencarian atau filter Anda.",
  taskHeader: "Tugas",
  updateDatesError: "Gagal memperbarui tanggal tugas",
  resizeStart: "Ubah ukuran tanggal mulai",
  resizeDue: "Ubah ukuran tenggat",
  taskAriaLabel: "{{title}}: buka atau seret untuk memindahkan",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
