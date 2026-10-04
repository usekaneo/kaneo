import {
  type AppLocale,
  defaultLocale,
  supportedLocales,
} from "@i18n/resources";
import { createFileRoute } from "@tanstack/react-router";
import { List, RotateCcw, SquareKanban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ThemePicker } from "@/components/account/theme-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLocale } from "@/hooks/use-locale";
import { getLocaleLabel } from "@/lib/i18n/get-locale-label";
import {
  isWeekStartDay,
  useUserPreferencesStore,
  WEEK_START_DAYS,
  type WeekStartDay,
} from "@/store/user-preferences";
import { AdvancedSettingsSwitch } from "@/components/settings/advanced-settings-switch";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/preferences",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const {
    theme,
    setTheme,
    weekStartsOn,
    setWeekStartsOn,
    viewMode,
    setViewMode,
    showTaskNumbers,
    setShowTaskNumbers,
    showAssignees,
    setShowAssignees,
    showDueDates,
    setShowDueDates,
    showLabels,
    setShowLabels,
    showPriority,
    setShowPriority,
    showProjectBackgrounds,
    setShowProjectBackgrounds,
    resetDisplayPreferences,
    sidebarDefaultOpen,
    setSidebarDefaultOpen,
  } = useUserPreferencesStore();

  const weekStartLabels: Record<WeekStartDay, string> = {
    0: t("settings:preferencesPage.weekStartsOnSunday"),
    1: t("settings:preferencesPage.weekStartsOnMonday"),
    6: t("settings:preferencesPage.weekStartsOnSaturday"),
  };

  const selectedLocale: AppLocale = locale ?? defaultLocale;

  return (
    <SettingsPage
      title={t("settings:preferencesPage.title")}
      description={t("settings:preferencesPage.subtitle")}
    >
      <div className="space-y-3">
        <SettingsSectionHeader
          title={t("settings:preferencesPage.theme")}
          description={t("settings:preferencesPage.themeDescription")}
        />
        <ThemePicker value={theme} onChange={setTheme} />
      </div>

      <div className="space-y-3">
        <SettingsSectionHeader
          title={t("settings:preferencesPage.appearanceTitle")}
          description={t("settings:preferencesPage.appearanceSubtitle")}
        />

        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.language")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.languageDescription")}
              </p>
            </div>
            <Select
              value={selectedLocale}
              onValueChange={(value) => {
                if (value) {
                  void setLocale(value as AppLocale);
                }
              }}
            >
              <SelectTrigger size="sm" className="w-full sm:w-40">
                <SelectValue
                  placeholder={t("settings:preferencesPage.selectLanguage")}
                >
                  {getLocaleLabel(selectedLocale)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {supportedLocales.map((supportedLocale) => (
                  <SelectItem key={supportedLocale} value={supportedLocale}>
                    {getLocaleLabel(supportedLocale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.firstDayOfWeek")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.firstDayOfWeekDescription")}
              </p>
            </div>
            <Select
              value={String(weekStartsOn)}
              onValueChange={(value) => {
                if (!value) {
                  return;
                }

                const parsedWeekStart = Number(value);

                if (isWeekStartDay(parsedWeekStart)) {
                  setWeekStartsOn(parsedWeekStart);
                }
              }}
            >
              <SelectTrigger size="sm" className="w-full sm:w-40">
                <SelectValue
                  placeholder={t(
                    "settings:preferencesPage.selectFirstDayOfWeek",
                  )}
                >
                  {weekStartLabels[weekStartsOn]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {WEEK_START_DAYS.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {weekStartLabels[day]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.defaultView")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.defaultViewDescription")}
              </p>
            </div>
            <ToggleGroup
              value={[viewMode]}
              onValueChange={(values) => {
                const next = values[0];
                if (next === "board" || next === "list") setViewMode(next);
              }}
              variant="outline"
              size="sm"
              aria-label={t("settings:preferencesPage.defaultView")}
            >
              <ToggleGroupItem value="board" className="gap-1.5 px-2.5">
                <SquareKanban aria-hidden="true" />
                {t("settings:preferencesPage.board")}
              </ToggleGroupItem>
              <ToggleGroupItem value="list" className="gap-1.5 px-2.5">
                <List aria-hidden="true" />
                {t("settings:preferencesPage.list")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label
                className="text-sm font-medium"
                htmlFor="show-project-backgrounds"
              >
                {t("settings:preferencesPage.projectBackgrounds")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.projectBackgroundsDescription")}
              </p>
            </div>
            <Switch
              id="show-project-backgrounds"
              checked={showProjectBackgrounds}
              onCheckedChange={setShowProjectBackgrounds}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label
                className="text-sm font-medium"
                htmlFor="sidebar-default-open"
              >
                {t("settings:preferencesPage.sidebarDefault")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.sidebarDefaultDescription")}
              </p>
            </div>
            <Switch
              id="sidebar-default-open"
              checked={sidebarDefaultOpen}
              onCheckedChange={setSidebarDefaultOpen}
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <SettingsSectionHeader
            title={t("settings:preferencesPage.displayOptions")}
            description={t(
              "settings:preferencesPage.displayOptionsDescription",
            )}
          />
          <Button
            variant="outline"
            size="xs"
            onClick={resetDisplayPreferences}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {t("common:actions.reset")}
          </Button>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label
                className="text-sm font-medium"
                htmlFor="show-task-numbers"
              >
                {t("settings:preferencesPage.taskNumbers")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.taskNumbersDescription")}
              </p>
            </div>
            <Switch
              id="show-task-numbers"
              checked={showTaskNumbers}
              onCheckedChange={setShowTaskNumbers}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium" htmlFor="show-asignees">
                {t("settings:preferencesPage.assignees")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.assigneesDescription")}
              </p>
            </div>
            <Switch
              id="show-asignees"
              checked={showAssignees}
              onCheckedChange={setShowAssignees}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium" htmlFor="show-due-dates">
                {t("settings:preferencesPage.dueDates")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.dueDatesDescription")}
              </p>
            </div>
            <Switch
              id="show-due-dates"
              checked={showDueDates}
              onCheckedChange={setShowDueDates}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium" htmlFor="show-labels">
                {t("settings:preferencesPage.labels")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.labelsDescription")}
              </p>
            </div>
            <Switch
              id="show-labels"
              checked={showLabels}
              onCheckedChange={setShowLabels}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium" htmlFor="show-priority">
                {t("settings:preferencesPage.priority")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.priorityDescription")}
              </p>
            </div>
            <Switch
              id="show-priority"
              checked={showPriority}
              onCheckedChange={setShowPriority}
            />
          </div>
        </div>
      </div>

      <AdvancedSettingsSwitch />
    </SettingsPage>
  );
}
