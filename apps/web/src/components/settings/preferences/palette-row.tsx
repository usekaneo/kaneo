import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PaletteSwatch } from "@/components/account/palette-swatch";
import { ThemePreviewWindow } from "@/components/account/theme-preview-window";
import { SettingsRow } from "@/components/settings/settings-row";
import { RadioGroup } from "@/components/ui/radio-group";
import { type ColorPalette, COLOR_PALETTES } from "@/store/color-palette";
import { useUserPreferencesStore } from "@/store/user-preferences";

const PALETTE_KEYS: Record<
  ColorPalette,
  { labelKey: string; descriptionKey: string }
> = {
  kaneo: {
    labelKey: "settings:preferencesPage.paletteKaneo",
    descriptionKey: "settings:preferencesPage.paletteKaneoDescription",
  },
  modern: {
    labelKey: "settings:preferencesPage.paletteModern",
    descriptionKey: "settings:preferencesPage.paletteModernDescription",
  },
};

export function PaletteRow() {
  const { t } = useTranslation();
  const palette = useUserPreferencesStore((state) => state.palette);
  const setPalette = useUserPreferencesStore((state) => state.setPalette);

  return (
    <SettingsRow
      stack
      title={t("settings:preferencesPage.palette")}
      description={t("settings:preferencesPage.paletteDescription")}
    >
      <RadioGroup
        value={palette}
        onValueChange={(next) => setPalette(next as ColorPalette)}
        aria-label={t("settings:preferencesPage.selectPalette")}
        className="grid w-full grid-cols-2 gap-3"
      >
        {COLOR_PALETTES.map((option) => {
          const checked = option === palette;
          const keys = PALETTE_KEYS[option];

          return (
            <label
              key={option}
              className="flex min-w-0 cursor-pointer flex-col gap-2"
            >
              <RadioPrimitive.Root
                value={option}
                aria-label={t(keys.labelKey)}
                className="h-20 overflow-hidden rounded-lg border border-border outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-checked:border-foreground data-checked:ring-2 data-checked:ring-foreground/15 sm:h-24"
              >
                <span className="grid h-full grid-cols-2">
                  <ThemePreviewWindow tone="light" />
                  <ThemePreviewWindow tone="dark" className="pl-0" />
                </span>
              </RadioPrimitive.Root>
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span
                  aria-hidden="true"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground has-[svg]:font-medium has-[svg]:text-foreground"
                >
                  {checked ? (
                    <Check aria-hidden="true" className="size-3.5" />
                  ) : null}
                  {t(keys.labelKey)}
                </span>
                <PaletteSwatch palette={option} />
              </span>
              <span className="text-xs text-muted-foreground">
                {t(keys.descriptionKey)}
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </SettingsRow>
  );
}
