import { getModifierKeyText } from "@/hooks/use-keyboard-shortcuts";

export const shortcuts = {
  project: {
    prefix: "p",
    create: "c",
    list: "l",
  },
  workspace: {
    prefix: "w",
    switch: "s",
    create: "c",
  },
  notification: {
    prefix: "n",
    open: "o",
  },
  sidebar: {
    prefix: getModifierKeyText(),
    toggle: "b",
  },
  palette: {
    prefix: getModifierKeyText(),
    open: "k",
  },
  search: {
    prefix: "/",
  },
  task: {
    prefix: "t",
    create: "c",
  },
  view: {
    prefix: "v",
    board: "b",
    list: "l",
    backlog: "k",
  },
  taskDetails: {
    status: "s",
    priority: "p",
    assignee: "a",
    labels: "l",
    dueDate: "d",
  },
  help: {
    key: "?",
  },
} as const;
