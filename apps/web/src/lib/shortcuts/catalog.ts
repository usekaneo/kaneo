import type { ShortcutScope } from "./registry";

export type ShortcutCategory =
  | "general"
  | "navigation"
  | "create"
  | "views"
  | "tasks"
  | "list"
  | "inbox"
  | "filters"
  | "editor";

export type ShortcutDefinition = {
  keys: readonly string[];
  category: ShortcutCategory;
  scope?: ShortcutScope;
  allowInInput?: boolean;
  allowInPopup?: boolean;
  display?: readonly string[];
  handledElsewhere?: boolean;
};

const editor = { category: "editor", handledElsewhere: true } as const;

const projectDigits = Array.from(
  { length: 9 },
  (_, index) => `ctrl+shift+${index + 1}`,
);

export const SHORTCUTS = {
  openCommandMenu: {
    keys: ["mod+k"],
    category: "general",
    allowInInput: true,
    allowInPopup: true,
  },
  openSearch: { keys: ["/"], category: "general" },
  openShortcuts: {
    keys: ["?", "mod+/"],
    category: "general",
    allowInInput: true,
  },
  submit: { keys: ["mod+enter"], category: "general", handledElsewhere: true },
  back: { keys: ["escape"], category: "general", handledElsewhere: true },
  switchWorkspace: { keys: ["o w"], category: "general" },
  logOut: { keys: ["alt+shift+q"], category: "general" },
  showDisplayOptions: { keys: ["shift+v"], category: "general", scope: "view" },
  dismissToasts: { keys: ["mod+alt+x"], category: "general" },

  toggleSidebar: { keys: ["["], category: "navigation" },
  goToHome: { keys: ["g h"], category: "navigation" },
  goToInbox: { keys: ["g i"], category: "navigation" },
  goToMyTasks: { keys: ["g m"], category: "navigation" },
  goToProjects: { keys: ["g p"], category: "navigation" },
  goToSettings: { keys: ["g s"], category: "navigation" },
  goToTasks: { keys: ["g a"], category: "navigation", scope: "view" },
  goToBacklog: { keys: ["g b"], category: "navigation", scope: "view" },
  goToProject: {
    keys: projectDigits,
    category: "navigation",
    display: ["ctrl+shift+1–9"],
  },
  openTask: { keys: ["o i"], category: "navigation" },
  openProject: { keys: ["o p"], category: "navigation" },

  createTask: { keys: ["c"], category: "create" },
  createProject: { keys: ["n p"], category: "create" },

  toggleLayout: { keys: ["mod+b"], category: "views", scope: "view" },

  changeStatus: { keys: ["s"], category: "tasks", scope: "task" },
  changePriority: { keys: ["p"], category: "tasks", scope: "task" },
  assignTask: { keys: ["a"], category: "tasks", scope: "task" },
  assignToMe: { keys: ["i"], category: "tasks", scope: "task" },
  changeLabels: { keys: ["l"], category: "tasks", scope: "task" },
  setDueDate: { keys: ["shift+d"], category: "tasks", scope: "task" },
  removeDueDate: { keys: ["mod+shift+d"], category: "tasks", scope: "task" },
  renameTask: { keys: ["shift+r"], category: "tasks", scope: "task" },
  editDescription: { keys: ["ctrl+shift+i"], category: "tasks", scope: "task" },
  commentOnTask: { keys: ["ctrl+m"], category: "tasks", scope: "task" },
  moveToProject: { keys: ["mod+shift+m"], category: "tasks", scope: "task" },
  deleteTask: { keys: ["mod+backspace"], category: "tasks", scope: "task" },
  createSubtask: { keys: ["mod+shift+o"], category: "tasks", scope: "task" },
  setParent: { keys: ["mod+shift+p"], category: "tasks", scope: "task" },
  openParent: { keys: ["mod+shift+arrowup"], category: "tasks", scope: "task" },
  openSubtask: {
    keys: ["mod+shift+arrowdown"],
    category: "tasks",
    scope: "task",
  },
  markBlockedBy: { keys: ["m b"], category: "tasks", scope: "task" },
  markBlocking: { keys: ["m x"], category: "tasks", scope: "task" },
  markRelated: { keys: ["m r"], category: "tasks", scope: "task" },
  addLink: { keys: ["ctrl+l"], category: "tasks", scope: "task" },
  toggleResources: { keys: ["ctrl+shift+l"], category: "tasks", scope: "task" },
  copyTaskId: { keys: ["mod+."], category: "tasks", scope: "task" },
  copyTaskUrl: { keys: ["mod+shift+,"], category: "tasks", scope: "task" },
  copyBranchName: { keys: ["mod+shift+."], category: "tasks", scope: "task" },
  copyTaskTitle: { keys: ["mod+shift+'"], category: "tasks", scope: "task" },
  copyAsMarkdown: { keys: ["mod+alt+c"], category: "tasks", scope: "task" },

  peekTask: { keys: ["space"], category: "list", scope: "view" },
  openFocusedTask: { keys: ["enter"], category: "list", scope: "view" },
  selectTask: { keys: ["x"], category: "list", scope: "view" },
  selectGroup: { keys: ["mod+alt+a"], category: "list", scope: "view" },
  selectAll: { keys: ["mod+a"], category: "list", handledElsewhere: true },
  clearSelection: {
    keys: ["escape"],
    category: "list",
    handledElsewhere: true,
  },
  copyPageUrl: { keys: ["mod+shift+c"], category: "list", scope: "view" },
  previousTask: { keys: ["k", "arrowup"], category: "list", scope: "view" },
  nextTask: { keys: ["j", "arrowdown"], category: "list", scope: "view" },
  focusRight: { keys: ["arrowright"], category: "list", scope: "view" },
  focusLeft: { keys: ["arrowleft"], category: "list", scope: "view" },
  moveTaskTop: { keys: ["alt+shift+arrowup"], category: "list", scope: "view" },
  moveTaskUp: { keys: ["alt+arrowup"], category: "list", scope: "view" },
  moveTaskDown: { keys: ["alt+arrowdown"], category: "list", scope: "view" },
  moveTaskBottom: {
    keys: ["alt+shift+arrowdown"],
    category: "list",
    scope: "view",
  },
  moveTaskLeft: { keys: ["alt+arrowleft"], category: "list", scope: "view" },
  moveTaskRight: { keys: ["alt+arrowright"], category: "list", scope: "view" },
  toggleGroup: { keys: ["t"], category: "list", scope: "view" },
  toggleAllGroups: { keys: ["alt+t"], category: "list", scope: "view" },

  deleteNotification: {
    keys: ["e", "backspace"],
    category: "inbox",
    scope: "view",
  },
  deleteReadNotifications: {
    keys: ["shift+backspace"],
    category: "inbox",
    scope: "view",
  },
  toggleNotificationRead: { keys: ["u"], category: "inbox", scope: "view" },
  markAllNotificationsRead: {
    keys: ["alt+u"],
    category: "inbox",
    scope: "view",
  },

  addFilter: { keys: ["f"], category: "filters", scope: "view" },
  clearAllFilters: {
    keys: ["alt+shift+f"],
    category: "filters",
    scope: "view",
  },
  clearLastFilter: { keys: ["shift+f"], category: "filters", scope: "view" },

  editorBold: { keys: ["mod+b"], ...editor },
  editorItalic: { keys: ["mod+i"], ...editor },
  editorUnderline: { keys: ["mod+u"], ...editor },
  editorStrike: { keys: ["mod+shift+x"], ...editor },
  editorAttach: { keys: ["mod+shift+u"], ...editor },
  editorInlineCode: { keys: ["mod+e"], ...editor },
  editorLink: { keys: ["mod+k"], ...editor },
  editorQuote: { keys: ["alt+shift+."], ...editor },
  editorParagraph: { keys: ["mod+alt+0"], ...editor },
  editorHeading1: { keys: ["mod+alt+1"], ...editor },
  editorHeading2: { keys: ["mod+alt+2"], ...editor },
  editorHeading3: { keys: ["mod+alt+3"], ...editor },
  editorChecklist: { keys: ["mod+shift+7"], ...editor },
  editorToggleChecklist: { keys: ["mod+enter"], ...editor },
  editorBulletList: { keys: ["mod+shift+8"], ...editor },
  editorNumberedList: { keys: ["mod+shift+9"], ...editor },
  editorCodeBlock: { keys: ["mod+shift+\\"], ...editor },
  editorUndo: { keys: ["mod+z"], ...editor },
  editorRedo: { keys: ["mod+shift+z"], ...editor },
} as const satisfies Record<string, ShortcutDefinition>;

export type ShortcutId = keyof typeof SHORTCUTS;

export const SHORTCUT_CATEGORIES: readonly ShortcutCategory[] = [
  "general",
  "navigation",
  "create",
  "views",
  "tasks",
  "list",
  "inbox",
  "filters",
  "editor",
];
