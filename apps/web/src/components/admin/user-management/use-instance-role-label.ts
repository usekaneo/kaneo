import { useTranslation } from "react-i18next";

/** Built-in roles are translated; custom roles show their name. */
export function useInstanceRoleLabel() {
  const { t } = useTranslation();
  return (role: string) =>
    role === "admin"
      ? t("settings:adminUsers.roles.admin")
      : role === "user"
        ? t("settings:adminUsers.roles.user")
        : role;
}
