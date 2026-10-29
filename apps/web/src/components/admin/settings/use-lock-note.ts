import { useTranslation } from "react-i18next";
import type { AdminSettings } from "@/fetchers/admin/settings-types";
import { ENV_LOCK_VARIABLES } from "./env-lock-variables";

type LockableSetting = AdminSettings["lockedByEnv"][number];

/** A one-line note naming the variable that locks a setting, if any. */
export function useLockNote(settings: AdminSettings) {
  const { t } = useTranslation();
  return (setting: LockableSetting) =>
    settings.lockedByEnv.includes(setting)
      ? t("settings:adminSettings.lockedByEnv", {
          name: ENV_LOCK_VARIABLES[setting],
        })
      : undefined;
}
