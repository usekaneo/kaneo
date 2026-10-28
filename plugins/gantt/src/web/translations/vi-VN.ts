import type { Messages } from "./en-US.js";

export const viVN = {
  view: {
    title: "Gantt",
  },
  status: {
    planned: "Đã lên kế hoạch",
  },
  title: "Dòng thời gian Gantt",
  jumpToToday: "Jump to today",
  hideTasks: "Ẩn công việc",
  showTasks: "Hiện công việc",
  noTasks: "Không có công việc đã lên lịch",
  noTasksSubtitle:
    "Thêm ngày bắt đầu, ngày đến hạn, hoặc cả hai cho công việc để đặt chúng lên dòng thời gian dự án.",
  noTasksFound: "Không tìm thấy công việc nào",
  noMatches: "Không có công việc nào khớp với tìm kiếm hoặc bộ lọc của bạn.",
  taskHeader: "Công việc",
  updateDatesError: "Không thể cập nhật ngày của công việc",
  resizeStart: "Thay đổi kích thước ngày bắt đầu",
  resizeDue: "Thay đổi kích thước ngày đến hạn",
  taskAriaLabel: "{{title}}: mở hoặc kéo để di chuyển",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
