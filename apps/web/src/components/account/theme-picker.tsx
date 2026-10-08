import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ThemePreviewWindow } from "@/components/account/theme-preview-window";
import { RadioGroup } from "@/components/ui/radio-group";
type Theme = "light" | "dark" | "system";

const THEMES: { value: Theme; labelKey: string }[] = [
  { value: "light", labelKey: "settings:preferencesPage.themeLight" },
  { value: "dark", labelKey: "settings:preferencesPage.themeDark" },
  { value: "system", labelKey: "settings:preferencesPage.themeSystem" },
];

type ThemePickerProps = {
  value: Theme;
  onChange: (theme: Theme) => void;
};

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  const { t } = useTranslation();

  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(next as Theme)}
      aria-label={t("settings:preferencesPage.theme")}
      className="grid grid-cols-3 gap-3"
    >
      {THEMES.map((theme) => {
        const checked = theme.value === value;

        return (
          <label
            key={theme.value}
            className="flex cursor-pointer flex-col gap-2"
          >
            <RadioPrimitive.Root
              value={theme.value}
              aria-label={t(theme.labelKey)}
              className="h-20 overflow-hidden rounded-lg border border-border outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-checked:border-foreground data-checked:ring-2 data-checked:ring-foreground/15 sm:h-24"
            >
              {theme.value === "system" ? (
                <span className="grid h-full grid-cols-2">
                  <ThemePreviewWindow tone="light" />
                  <ThemePreviewWindow tone="dark" className="pl-0" />
                </span>
              ) : (
                <ThemePreviewWindow tone={theme.value} />
              )}
            </RadioPrimitive.Root>
            <span
              aria-hidden="true"
              className="flex items-center gap-1.5 text-xs text-muted-foreground has-[svg]:font-medium has-[svg]:text-foreground"
            >
              {checked ? (
                <Check aria-hidden="true" className="size-3.5" />
              ) : null}
              {t(theme.labelKey)}
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}
