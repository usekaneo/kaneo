import type { Messages } from "./en-US.js";

export const zhCN = {
  view: {
    title: "甘特图",
  },
  status: {
    planned: "已计划",
  },
  title: "甘特图时间线",
  jumpToToday: "回到今天",
  searchPlaceholder: "搜索已排期工单…",
  hideTasks: "隐藏任务",
  showTasks: "显示任务",
  noTasks: "无已排期任务",
  noTasksSubtitle: "为任务添加开始日期、截止日期或两者，以将其放入项目时间线。",
  noTasksFound: "未找到任务",
  noTasksMatch: '没有匹配 "{{query}}" 的已排期任务',
  taskHeader: "任务",
  updateDatesError: "更新任务日期失败",
  resizeStart: "调整开始日期",
  resizeDue: "调整截止日期",
  taskAriaLabel: "{{title}}：打开或拖动以移动",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
