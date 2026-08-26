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
  COLOR_PRESETS,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  isHexColor,
  normalizeHexColor,
} from "@/lib/brand-colors";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

type DraftColors = {
  primaryColor: string;
  accentColor: string;
};

function colorsEqual(a: DraftColors, b: DraftColors) {
  return (
    a.primaryColor.toUpperCase() === b.primaryColor.toUpperCase() &&
    a.accentColor.toUpperCase() === b.accentColor.toUpperCase()
  );
}

export function ColorThemeSettings() {
  const { t } = useTranslation();
  const { branding, setBrandingLocal, refresh } = useBranding();
  const [draft, setDraft] = useState<DraftColors>({
    primaryColor: branding.primaryColor,
    accentColor: branding.accentColor ?? DEFAULT_ACCENT_COLOR,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({
      primaryColor: branding.primaryColor,
      accentColor: branding.accentColor ?? DEFAULT_ACCENT_COLOR,
    });
  }, [branding.primaryColor, branding.accentColor]);

  const saved: DraftColors = {
    primaryColor: branding.primaryColor,
    accentColor: branding.accentColor ?? DEFAULT_ACCENT_COLOR,
  };
  const isDirty = !colorsEqual(draft, saved);
  const isDefault =
    draft.primaryColor.toUpperCase() === DEFAULT_PRIMARY_COLOR.toUpperCase() &&
    draft.accentColor.toUpperCase() === DEFAULT_ACCENT_COLOR.toUpperCase();

  const applyDraft = (next: DraftColors) => {
    setDraft(next);
    setBrandingLocal({
      primaryColor: next.primaryColor,
      accentColor: next.accentColor,
    });
  };

  const updatePrimary = (value: string) => {
    const normalized = normalizeHexColor(value);
    if (normalized) {
      applyDraft({ ...draft, primaryColor: normalized });
      return;
    }
    setDraft((prev) => ({ ...prev, primaryColor: value }));
  };

  const updateAccent = (value: string) => {
    const normalized = normalizeHexColor(value);
    if (normalized) {
      applyDraft({ ...draft, accentColor: normalized });
      return;
    }
    setDraft((prev) => ({ ...prev, accentColor: value }));
  };

  const selectPreset = (preset: (typeof COLOR_PRESETS)[number]) => {
    applyDraft({
      primaryColor: preset.primaryColor,
      accentColor: preset.accentColor,
    });
  };

  const resetToDefault = () => {
    applyDraft({
      primaryColor: DEFAULT_PRIMARY_COLOR,
      accentColor: DEFAULT_ACCENT_COLOR,
    });
  };

  const discardChanges = () => {
    applyDraft(saved);
  };

  const save = async () => {
    if (!isHexColor(draft.primaryColor) || !isHexColor(draft.accentColor)) {
      toast.error(t("settings:colorTheme.invalidColor"));
      return;
    }

    setSaving(true);
    try {
      const next = await updateBranding({
        primaryColor: draft.primaryColor,
        accentColor: draft.accentColor,
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

  const activePresetId = COLOR_PRESETS.find((preset) =>
    colorsEqual(draft, {
      primaryColor: preset.primaryColor,
      accentColor: preset.accentColor,
    }),
  )?.id;

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
                      style={{ backgroundColor: preset.primaryColor }}
                    />
                    <span
                      className="size-4 rounded-full border border-border"
                      style={{ backgroundColor: preset.accentColor }}
                    />
                  </span>
                  {t(`settings:colorTheme.preset.${preset.id}`)}
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <ColorSlot
            id="primaryColor"
            label={t("settings:colorTheme.primary")}
            description={t("settings:colorTheme.primaryDescription")}
            value={draft.primaryColor}
            onChange={updatePrimary}
          />
          <ColorSlot
            id="accentColor"
            label={t("settings:colorTheme.accent")}
            description={t("settings:colorTheme.accentDescription")}
            value={draft.accentColor}
            onChange={updateAccent}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {t("settings:colorTheme.preview")}
          </Label>
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3">
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
            <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full w-2/3 rounded-full"
                style={{ backgroundColor: draft.primaryColor }}
              />
            </div>
            <span
              className="text-sm font-medium"
              style={{ color: draft.primaryColor }}
            >
              {t("settings:colorTheme.previewLink")}
            </span>
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
  const pickerValue = isHexColor(value) ? value : DEFAULT_PRIMARY_COLOR;

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
