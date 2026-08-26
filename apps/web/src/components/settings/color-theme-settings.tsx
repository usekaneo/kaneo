import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { updateBranding } from "@/fetchers/branding/update-branding";
import { useBranding } from "@/hooks/use-branding";
import {
  type BrandPalette,
  COLOR_PRESETS,
  DEFAULT_PALETTE,
  isHexColor,
  normalizeHexColor,
  palettesEqual,
  resolvePalette,
} from "@/lib/brand-colors";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

type DraftColors = BrandPalette;

function draftFromBranding(branding: {
  primaryColor: string;
  accentColor?: string | null;
  backgroundColor?: string | null;
  foregroundColor?: string | null;
  cardColor?: string | null;
  mutedColor?: string | null;
  borderColor?: string | null;
  sidebarBackgroundColor?: string | null;
  sidebarForegroundColor?: string | null;
}): DraftColors {
  return resolvePalette(branding);
}

const PALETTE_KEYS = Object.keys(DEFAULT_PALETTE) as (keyof BrandPalette)[];

export function ColorThemeSettings() {
  const { t } = useTranslation();
  const { branding, setBrandingLocal, refresh } = useBranding();
  const [draft, setDraft] = useState<DraftColors>(() =>
    draftFromBranding(branding),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(draftFromBranding(branding));
  }, [branding]);

  const saved = draftFromBranding(branding);
  const isDirty = !palettesEqual(draft, saved);
  const isDefault = palettesEqual(draft, DEFAULT_PALETTE);

  const applyDraft = (next: DraftColors) => {
    setDraft(next);
    setBrandingLocal(next);
  };

  const updateColor = (key: keyof BrandPalette, value: string) => {
    const normalized = normalizeHexColor(value);
    if (normalized) {
      applyDraft({ ...draft, [key]: normalized });
      return;
    }
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const selectPreset = (preset: (typeof COLOR_PRESETS)[number]) => {
    const { id: _id, ...palette } = preset;
    applyDraft(palette);
  };

  const resetToDefault = () => {
    applyDraft({ ...DEFAULT_PALETTE });
  };

  const discardChanges = () => {
    applyDraft(saved);
  };

  const save = async () => {
    if (PALETTE_KEYS.some((key) => !isHexColor(draft[key]))) {
      toast.error(t("settings:colorTheme.invalidColor"));
      return;
    }

    setSaving(true);
    try {
      const next = await updateBranding(draft);
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
    const { id: _id, ...palette } = preset;
    return palettesEqual(draft, palette);
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
                        backgroundColor: preset.sidebarBackgroundColor,
                      }}
                    />
                    <span
                      className="size-4 rounded-full border border-border"
                      style={{ backgroundColor: preset.backgroundColor }}
                    />
                    <span
                      className="size-4 rounded-full border border-border"
                      style={{ backgroundColor: preset.primaryColor }}
                    />
                  </span>
                  {t(`settings:colorTheme.preset.${preset.id}`)}
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

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
              id="primaryColor"
              label={t("settings:colorTheme.primary")}
              description={t("settings:colorTheme.primaryDescription")}
              value={draft.primaryColor}
              onChange={(value) => updateColor("primaryColor", value)}
            />
            <ColorSlot
              id="accentColor"
              label={t("settings:colorTheme.accent")}
              description={t("settings:colorTheme.accentDescription")}
              value={draft.accentColor}
              onChange={(value) => updateColor("accentColor", value)}
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
              id="sidebarBackgroundColor"
              label={t("settings:colorTheme.sidebarBackground")}
              description={t(
                "settings:colorTheme.sidebarBackgroundDescription",
              )}
              value={draft.sidebarBackgroundColor}
              onChange={(value) => updateColor("sidebarBackgroundColor", value)}
            />
            <ColorSlot
              id="sidebarForegroundColor"
              label={t("settings:colorTheme.sidebarForeground")}
              description={t(
                "settings:colorTheme.sidebarForegroundDescription",
              )}
              value={draft.sidebarForegroundColor}
              onChange={(value) => updateColor("sidebarForegroundColor", value)}
            />
            <ColorSlot
              id="backgroundColor"
              label={t("settings:colorTheme.background")}
              description={t("settings:colorTheme.backgroundDescription")}
              value={draft.backgroundColor}
              onChange={(value) => updateColor("backgroundColor", value)}
            />
            <ColorSlot
              id="foregroundColor"
              label={t("settings:colorTheme.foreground")}
              description={t("settings:colorTheme.foregroundDescription")}
              value={draft.foregroundColor}
              onChange={(value) => updateColor("foregroundColor", value)}
            />
            <ColorSlot
              id="cardColor"
              label={t("settings:colorTheme.card")}
              description={t("settings:colorTheme.cardDescription")}
              value={draft.cardColor}
              onChange={(value) => updateColor("cardColor", value)}
            />
            <ColorSlot
              id="mutedColor"
              label={t("settings:colorTheme.muted")}
              description={t("settings:colorTheme.mutedDescription")}
              value={draft.mutedColor}
              onChange={(value) => updateColor("mutedColor", value)}
            />
            <ColorSlot
              id="borderColor"
              label={t("settings:colorTheme.border")}
              description={t("settings:colorTheme.borderDescription")}
              value={draft.borderColor}
              onChange={(value) => updateColor("borderColor", value)}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {t("settings:colorTheme.preview")}
          </Label>
          <div
            className="overflow-hidden rounded-md border"
            style={{
              borderColor: draft.borderColor,
              backgroundColor: draft.backgroundColor,
              color: draft.foregroundColor,
            }}
          >
            <div className="flex min-h-36">
              <aside
                className="flex w-28 shrink-0 flex-col gap-2 border-r p-3 text-[10px]"
                style={{
                  backgroundColor: draft.sidebarBackgroundColor,
                  borderColor: draft.borderColor,
                  color: draft.sidebarForegroundColor,
                }}
              >
                <span
                  className="font-medium"
                  style={{ color: draft.foregroundColor }}
                >
                  {t("settings:colorTheme.previewSidebar")}
                </span>
                <span
                  className="rounded px-1.5 py-1"
                  style={{
                    backgroundColor: draft.mutedColor,
                    color: draft.foregroundColor,
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
                      borderColor: draft.accentColor,
                      color: draft.accentColor,
                    }}
                  >
                    {t("settings:colorTheme.previewAccent")}
                  </Button>
                  <div
                    className="h-2 w-24 overflow-hidden rounded-full"
                    style={{ backgroundColor: draft.mutedColor }}
                  >
                    <div
                      className="h-full w-2/3 rounded-full"
                      style={{ backgroundColor: draft.primaryColor }}
                    />
                  </div>
                </div>
                <div
                  className="rounded-md border p-3 text-xs"
                  style={{
                    backgroundColor: draft.cardColor,
                    borderColor: draft.borderColor,
                    color: draft.foregroundColor,
                  }}
                >
                  <p className="font-medium">
                    {t("settings:colorTheme.previewCard")}
                  </p>
                  <p
                    className="mt-1"
                    style={{ color: draft.sidebarForegroundColor }}
                  >
                    {t("settings:colorTheme.previewCardMuted")}
                  </p>
                </div>
              </div>
            </div>
          </div>
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
  const pickerValue = isHexColor(value) ? value : DEFAULT_PALETTE.primaryColor;

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
