import type { TFunction } from "i18next";

export function personStatusLabel(t: TFunction, status: string) {
  switch (status) {
    case "on_leave":
      return t("people:status.on_leave");
    case "inactive":
      return t("people:status.inactive");
    default:
      return t("people:status.active");
  }
}

export function roleLabel(t: TFunction, role: string) {
  switch (role) {
    case "owner":
      return t("team:roles.owner");
    case "admin":
      return t("team:roles.admin");
    case "manager":
      return t("team:roles.manager");
    case "member":
      return t("team:roles.member");
    case "viewer":
      return t("team:roles.viewer");
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}
