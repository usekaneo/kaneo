import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { updateBranding } from "@/fetchers/branding/update-branding";
import { useBranding } from "@/hooks/use-branding";
import {
  type BrandPalette,
  COLOR_PRESETS,
  DEFAULT_DARK_PALETTE,
  DEFAULT_THEME_PALETTES,
  isHexColor,
  normalizeHexColor,
  type ThemePalettes,
  themePalettesEqual,
} from "@/lib/brand-colors";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

type PaletteMode = keyof ThemePalettes;

function palettesFromBranding(branding: {
  paletteDark: BrandPalette;
  paletteLight: BrandPalette;
}): ThemePalettes {
  return {
    dark: branding.paletteDark,
    light: branding.paletteLight,
  };
}

const PALETTE_KEYS = Object.keys(
  DEFAULT_DARK_PALETTE,
) as (keyof BrandPalette)[];

export function ColorThemeSettings() {
  const { t } = useTranslation();
  const { branding, setBrandingLocal, refresh } = useBranding();
  const [draft, setDraft] = useState<ThemePalettes>(() =>
    palettesFromBranding(branding),
  );
  const [activeMode, setActiveMode] = useState<PaletteMode>("dark");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(palettesFromBranding(branding));
  }, [branding]);

  const saved = palettesFromBranding(branding);
  const isDirty = !themePalettesEqual(draft, saved);
  const isDefault = themePalettesEqual(draft, DEFAULT_THEME_PALETTES);
  const activePalette = draft[activeMode];

  const applyDraft = (next: ThemePalettes) => {
    setDraft(next);
    setBrandingLocal({
      paletteDark: next.dark,
      paletteLight: next.light,
    });
  };

  const updateColor = (key: keyof BrandPalette, value: string) => {
    const normalized = normalizeHexColor(value);
    if (normalized) {
      applyDraft({
        ...draft,
        [activeMode]: { ...draft[activeMode], [key]: normalized },
      });
      return;
    }
    setDraft((prev) => ({
      ...prev,
      [activeMode]: { ...prev[activeMode], [key]: value },
    }));
  };

  const selectPreset = (preset: (typeof COLOR_PRESETS)[number]) => {
    const { id: _id, light, dark } = preset;
    applyDraft({ light, dark });
  };

  const resetToDefault = () => {
    applyDraft({ ...DEFAULT_THEME_PALETTES });
  };

  const discardChanges = () => {
    applyDraft(saved);
  };

  const save = async () => {
    if (
      PALETTE_KEYS.some((key) => !isHexColor(draft.dark[key])) ||
      PALETTE_KEYS.some((key) => !isHexColor(draft.light[key]))
    ) {
      toast.error(t("settings:colorTheme.invalidColor"));
      return;
    }

    setSaving(true);
    try {
      const next = await updateBranding({
        ...draft.dark,
        paletteLight: draft.light,
      });
      setBrandingLocal(next);
      await refresh();
      toast.success(t("settings:colorTheme.saveSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:colorTheme.saveError"),
      );
    } finally {
      setSaving(false);
    }
  };

  const activePresetId = COLOR_PRESETS.find((preset) => {
    const { id: _id, light, dark } = preset;
    return themePalettesEqual(draft, { light, dark });
  })?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-md font-medium">
            {t("settings:colorTheme.title")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("settings:colorTheme.subtitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={resetToDefault}
          disabled={isDefault}
          className="flex shrink-0 items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          {t("settings:colorTheme.reset")}
        </Button>
      </div>

      <div className="space-y-4 rounded-md border border-border bg-sidebar p-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {t("settings:colorTheme.presets")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("settings:colorTheme.presetsDescription")}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {COLOR_PRESETS.map((preset) => {
              const isActive = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => selectPreset(preset)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                    isActive
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-accent",
                  )}
                  aria-pressed={isActive}
                >
                  <span className="flex -space-x-1" aria-hidden>
                    <span
                      className="size-4 rounded-full border border-border"
                      style={{
                        backgroundColor: preset.dark.sidebarBackgroundColor,
                      }}
                    />
                    <span
                      className="size-4 rounded-full border border-border"
                      style={{
                        backgroundColor: preset.light.backgroundColor,
                      }}
                    />
                    <span
                      className="size-4 rounded-full border border-border"
                      style={{ backgroundColor: preset.dark.primaryColor }}
                    />
                  </span>
                  {t(`settings:colorTheme.preset.${preset.id}`)}
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        <Tabs
          value={activeMode}
          onValueChange={(value) => setActiveMode(value as PaletteMode)}
        >
          <TabsList className="w-full sm:w-auto">
            <TabsTab value="light">
              {t("settings:colorTheme.modeLight")}
            </TabsTab>
            <TabsTab value="dark">{t("settings:colorTheme.modeDark")}</TabsTab>
          </TabsList>
          <p className="text-xs text-muted-foreground">
            {t("settings:colorTheme.modeDescription")}
          </p>

          <div className="space-y-4 pt-2">
            <PaletteEditor
              mode={activeMode}
              palette={activePalette}
              onUpdateColor={updateColor}
              t={t}
            />
          </div>
        </Tabs>

        <Separator />

        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {t("settings:colorTheme.preview")}{" "}
            <span className="font-normal text-muted-foreground">
              (
              {activeMode === "light"
                ? t("settings:colorTheme.modeLight")
                : t("settings:colorTheme.modeDark")}
              )
            </span>
          </Label>
          <PalettePreview palette={activePalette} t={t} />
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {isDirty ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={discardChanges}
              disabled={saving}
            >
              {t("common:actions.cancel")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={() => void save()}
            disabled={!isDirty || saving}
          >
            {saving
              ? t("settings:colorTheme.saving")
              : t("settings:colorTheme.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PaletteEditor({
  mode,
  palette,
  onUpdateColor,
  t,
}: {
  mode: PaletteMode;
  palette: BrandPalette;
  onUpdateColor: (key: keyof BrandPalette, value: string) => void;
  t: (key: string) => string;
}) {
  const fieldId = (key: string) => `${mode}-${key}`;
  return (
    <>
      <div className="space-y-3">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">
            {t("settings:colorTheme.brandSection")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("settings:colorTheme.brandSectionDescription")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorSlot
            id={fieldId("primaryColor")}
            label={t("settings:colorTheme.primary")}
            description={t("settings:colorTheme.primaryDescription")}
            value={palette.primaryColor}
            onChange={(value) => onUpdateColor("primaryColor", value)}
          />
          <ColorSlot
            id={fieldId("accentColor")}
            label={t("settings:colorTheme.accent")}
            description={t("settings:colorTheme.accentDescription")}
            value={palette.accentColor}
            onChange={(value) => onUpdateColor("accentColor", value)}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">
            {t("settings:colorTheme.chromeSection")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("settings:colorTheme.chromeSectionDescription")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorSlot
            id={fieldId("sidebarBackgroundColor")}
            label={t("settings:colorTheme.sidebarBackground")}
            description={t("settings:colorTheme.sidebarBackgroundDescription")}
            value={palette.sidebarBackgroundColor}
            onChange={(value) => onUpdateColor("sidebarBackgroundColor", value)}
          />
          <ColorSlot
            id={fieldId("sidebarForegroundColor")}
            label={t("settings:colorTheme.sidebarForeground")}
            description={t("settings:colorTheme.sidebarForegroundDescription")}
            value={palette.sidebarForegroundColor}
            onChange={(value) => onUpdateColor("sidebarForegroundColor", value)}
          />
          <ColorSlot
            id={fieldId("backgroundColor")}
            label={t("settings:colorTheme.background")}
            description={t("settings:colorTheme.backgroundDescription")}
            value={palette.backgroundColor}
            onChange={(value) => onUpdateColor("backgroundColor", value)}
          />
          <ColorSlot
            id={fieldId("foregroundColor")}
            label={t("settings:colorTheme.foreground")}
            description={t("settings:colorTheme.foregroundDescription")}
            value={palette.foregroundColor}
            onChange={(value) => onUpdateColor("foregroundColor", value)}
          />
          <ColorSlot
            id={fieldId("cardColor")}
            label={t("settings:colorTheme.card")}
            description={t("settings:colorTheme.cardDescription")}
            value={palette.cardColor}
            onChange={(value) => onUpdateColor("cardColor", value)}
          />
          <ColorSlot
            id={fieldId("mutedColor")}
            label={t("settings:colorTheme.muted")}
            description={t("settings:colorTheme.mutedDescription")}
            value={palette.mutedColor}
            onChange={(value) => onUpdateColor("mutedColor", value)}
          />
          <ColorSlot
            id={fieldId("borderColor")}
            label={t("settings:colorTheme.border")}
            description={t("settings:colorTheme.borderDescription")}
            value={palette.borderColor}
            onChange={(value) => onUpdateColor("borderColor", value)}
          />
        </div>
      </div>
    </>
  );
}

function PalettePreview({
  palette,
  t,
}: {
  palette: BrandPalette;
  t: (key: string) => string;
}) {
  return (
    <div
      className="overflow-hidden rounded-md border"
      style={{
        borderColor: palette.borderColor,
        backgroundColor: palette.backgroundColor,
        color: palette.foregroundColor,
      }}
    >
      <div className="flex min-h-36">
        <aside
          className="flex w-28 shrink-0 flex-col gap-2 border-r p-3 text-[10px]"
          style={{
            backgroundColor: palette.sidebarBackgroundColor,
            borderColor: palette.borderColor,
            color: palette.sidebarForegroundColor,
          }}
        >
          <span
            className="font-medium"
            style={{ color: palette.foregroundColor }}
          >
            {t("settings:colorTheme.previewSidebar")}
          </span>
          <span
            className="rounded px-1.5 py-1"
            style={{
              backgroundColor: palette.mutedColor,
              color: palette.foregroundColor,
            }}
          >
            {t("settings:colorTheme.previewNav")}
          </span>
          <span>{t("settings:colorTheme.previewNavMuted")}</span>
        </aside>
        <div className="flex flex-1 flex-col gap-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm">
              {t("settings:colorTheme.previewPrimary")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              style={{
                borderColor: palette.accentColor,
                color: palette.accentColor,
              }}
            >
              {t("settings:colorTheme.previewAccent")}
            </Button>
            <div
              className="h-2 w-24 overflow-hidden rounded-full"
              style={{ backgroundColor: palette.mutedColor }}
            >
              <div
                className="h-full w-2/3 rounded-full"
                style={{ backgroundColor: palette.primaryColor }}
              />
            </div>
          </div>
          <div
            className="rounded-md border p-3 text-xs"
            style={{
              backgroundColor: palette.cardColor,
              borderColor: palette.borderColor,
              color: palette.foregroundColor,
            }}
          >
            <p className="font-medium">
              {t("settings:colorTheme.previewCard")}
            </p>
            <p
              className="mt-1"
              style={{ color: palette.sidebarForegroundColor }}
            >
              {t("settings:colorTheme.previewCardMuted")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorSlot({
  id,
  label,
  description,
  value,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const pickerValue = isHexColor(value)
    ? value
    : DEFAULT_DARK_PALETTE.primaryColor;

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-2">
        <Input
          id={id}
          type="color"
          className="h-10 w-14 shrink-0 cursor-pointer p-1"
          value={pickerValue}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#0F766E"
          className="font-mono text-sm uppercase"
          maxLength={7}
        />
      </div>
    </div>
  );
}
