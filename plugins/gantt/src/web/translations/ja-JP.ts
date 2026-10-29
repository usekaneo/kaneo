import type { Messages } from "./en-US.js";

export const jaJP = {
  view: {
    title: "ガント",
  },
  status: {
    planned: "計画中",
  },
  title: "ガントタイムライン",
  jumpToToday: "Jump to today",
  hideTasks: "タスクを非表示",
  showTasks: "タスクを表示",
  noTasks: "スケジュール済みのタスクはありません",
  noTasksSubtitle:
    "タスクに開始日や期限を設定して、プロジェクトのタイムラインに配置します。",
  noTasksFound: "タスクが見つかりません",
  noMatches: "検索またはフィルターに一致するタスクはありません。",
  taskHeader: "タスク",
  updateDatesError: "タスクの日程の更新に失敗しました",
  resizeStart: "開始日を変更",
  resizeDue: "期限を変更",
  taskAriaLabel: "{{title}}: 開く、またはドラッグして移動",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
