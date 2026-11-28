import type { Messages } from "./en-US.js";

export const zhTW = {
  view: {
    title: "甘特圖",
  },
  status: {
    planned: "已規劃",
  },
  title: "甘特圖時間軸",
  jumpToToday: "回到今天",
  hideTasks: "隱藏任務",
  showTasks: "顯示任務",
  noTasks: "沒有已排程的任務",
  noTasksSubtitle:
    "為任務加上開始日期、截止日期或兩者，任務就會顯示在專案時間軸上。",
  noTasksFound: "找不到任務",
  noMatches: "沒有符合搜尋或篩選條件的任務。",
  taskHeader: "任務",
  updateDatesError: "更新任務日期失敗",
  resizeStart: "調整開始日期",
  resizeDue: "調整截止日期",
  taskAriaLabel: "{{title}}：開啟或拖曳以移動",
  previousPeriod: "上一個期間",
  nextPeriod: "下一個期間",
  periodStart: "時間軸開始日期",
  showTaskDates: "顯示任務日期",
} satisfies Messages;
