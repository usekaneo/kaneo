import { useTranslation } from "react-i18next";
import {
  DEFAULT_COLUMN_BACKDROP,
  useUserPreferencesStore,
} from "@/store/user-preferences";
import { ColumnBackdropSlider } from "./column-backdrop-slider";

const PERCENT: Intl.NumberFormatOptions = { style: "unit", unit: "percent" };

export function ColumnBackdropSliders() {
  const { t } = useTranslation();
  const opacity = useUserPreferencesStore((state) => state.columnOpacity);
  const setOpacity = useUserPreferencesStore((state) => state.setColumnOpacity);
  const blur = useUserPreferencesStore((state) => state.columnBlur);
  const setBlur = useUserPreferencesStore((state) => state.setColumnBlur);

  return (
    <div className="flex flex-col gap-4 pt-3 pb-2">
      <ColumnBackdropSlider
        label={t("tasks:display.columnOpacity")}
        resetLabel={t("tasks:display.resetColumnOpacity")}
        value={opacity}
        defaultValue={DEFAULT_COLUMN_BACKDROP.opacity}
        max={100}
        step={5}
        format={PERCENT}
        onChange={setOpacity}
      />
      <ColumnBackdropSlider
        label={t("tasks:display.columnBlur")}
        resetLabel={t("tasks:display.resetColumnBlur")}
        value={blur}
        defaultValue={DEFAULT_COLUMN_BACKDROP.blur}
        max={24}
        step={1}
        onChange={setBlur}
      />
    </div>
  );
}
