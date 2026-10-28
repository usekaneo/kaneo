import type { UserActionType } from "./pending-user-action";

type ActionCopy = {
  menu: string;
  title: string;
  description?: string;
  action: string;
  destructive: boolean;
};

export const USER_ACTION_COPY: Record<UserActionType, ActionCopy> = {
  sendPasswordReset: {
    menu: "settings:adminUsers.actions.sendPasswordReset",
    title: "settings:adminUsers.confirm.sendPasswordReset.title",
    action: "settings:adminUsers.confirm.sendPasswordReset.action",
    destructive: false,
  },
  sendVerification: {
    menu: "settings:adminUsers.actions.sendVerification",
    title: "settings:adminUsers.confirm.sendVerification.title",
    action: "settings:adminUsers.confirm.sendVerification.action",
    destructive: false,
  },
  markEmailVerified: {
    menu: "settings:adminUsers.actions.markEmailVerified",
    title: "settings:adminUsers.confirm.markEmailVerified.title",
    action: "settings:adminUsers.confirm.markEmailVerified.action",
    destructive: false,
  },
  deactivate: {
    menu: "settings:adminUsers.actions.deactivate",
    title: "settings:adminUsers.confirm.deactivate.title",
    description: "settings:adminUsers.confirm.deactivate.description",
    action: "settings:adminUsers.confirm.deactivate.action",
    destructive: true,
  },
  reactivate: {
    menu: "settings:adminUsers.actions.reactivate",
    title: "settings:adminUsers.confirm.reactivate.title",
    description: "settings:adminUsers.confirm.reactivate.description",
    action: "settings:adminUsers.confirm.reactivate.action",
    destructive: false,
  },
  delete: {
    menu: "common:actions.delete",
    title: "settings:adminUsers.confirm.delete.title",
    description: "settings:adminUsers.confirm.delete.description",
    action: "settings:adminUsers.confirm.delete.action",
    destructive: true,
  },
};
