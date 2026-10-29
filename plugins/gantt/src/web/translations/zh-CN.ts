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
  hideTasks: "隐藏任务",
  showTasks: "显示任务",
  noTasks: "无已排期任务",
  noTasksSubtitle: "为任务添加开始日期、截止日期或两者，以将其放入项目时间线。",
  noTasksFound: "未找到任务",
  noMatches: "没有任务符合你的搜索或筛选条件。",
  taskHeader: "任务",
  updateDatesError: "更新任务日期失败",
  resizeStart: "调整开始日期",
  resizeDue: "调整截止日期",
  taskAriaLabel: "{{title}}：打开或拖动以移动",
  previousPeriod: "上一周期",
  nextPeriod: "下一周期",
  periodStart: "时间线开始日期",
  showTaskDates: "显示任务日期",
} satisfies Messages;
