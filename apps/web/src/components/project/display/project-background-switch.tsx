import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function ProjectBackgroundSwitch() {
  const { t } = useTranslation();
  const id = useId();
  const checked = useUserPreferencesStore(
    (state) => state.showProjectBackgrounds,
  );
  const setChecked = useUserPreferencesStore(
    (state) => state.setShowProjectBackgrounds,
  );

  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm">
        {t("tasks:display.projectBackground")}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={setChecked} />
    </div>
  );
}
