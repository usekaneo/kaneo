import type { Messages } from "./en-US.js";

export const koKR = {
  view: {
    title: "간트",
  },
  status: {
    planned: "계획됨",
  },
  title: "간트 타임라인",
  jumpToToday: "Jump to today",
  hideTasks: "작업 숨기기",
  showTasks: "작업 표시",
  noTasks: "예약된 작업 없음",
  noTasksSubtitle:
    "프로젝트 타임라인에 작업을 배치하려면 시작일, 마감일 또는 둘 다 추가하세요.",
  noTasksFound: "작업을 찾을 수 없음",
  noMatches: "검색 또는 필터와 일치하는 작업이 없습니다.",
  taskHeader: "작업",
  updateDatesError: "작업 날짜 업데이트에 실패했습니다",
  resizeStart: "시작일 크기 조정",
  resizeDue: "마감일 크기 조정",
  taskAriaLabel: "{{title}}: 열거나 드래그하여 이동",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
