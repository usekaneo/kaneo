import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, List, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { useLocale } from "@/hooks/use-locale";
import { useUserPreferencesStore } from "@/store/user-preferences";

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
    viewMode,
    setViewMode,
    compactMode,
    setCompactMode,
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
    resetDisplayPreferences,
    sidebarDefaultOpen,
    setSidebarDefaultOpen,
  } = useUserPreferencesStore();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {t("settings:preferencesPage.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("settings:preferencesPage.subtitle")}
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-md font-medium">
            {t("settings:preferencesPage.appearanceTitle")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("settings:preferencesPage.appearanceSubtitle")}
          </p>
        </div>

        <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.theme")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.themeDescription")}
              </p>
            </div>
            <Select
              value={theme}
              onValueChange={(value) => value && setTheme(value)}
            >
              <SelectTrigger className="!py-4">
                <SelectValue
                  placeholder={t("settings:preferencesPage.selectTheme")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 rounded-md border border-border bg-muted p-1">
                      <span className="rounded-full size-2 bg-primary" />
                      <span className="text-xs font-normal text-foreground">
                        Aa
                      </span>
                    </div>
                    <span className="text-xs font-normal">
                      {t("settings:preferencesPage.themeLight")}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
                      <span className="rounded-full size-2 bg-primary" />
                      <span className="text-xs font-normal text-foreground">
                        Aa
                      </span>
                    </div>
                    <span className="text-xs font-normal">
                      {t("settings:preferencesPage.themeDark")}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <span className="text-xs font-normal">
                    {t("settings:preferencesPage.themeSystem")}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.language")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.languageDescription")}
              </p>
            </div>
            <Select
              value={locale ?? "en-US"}
              onValueChange={(value) => {
                if (value) {
                  void setLocale(value);
                }
              }}
            >
              <SelectTrigger className="!py-4">
                <SelectValue
                  placeholder={t("settings:preferencesPage.selectLanguage")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-US">
                  {t("common:language.english")}
                </SelectItem>
                <SelectItem value="de-DE">
                  {t("common:language.german")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.defaultView")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.defaultViewDescription")}
              </p>
            </div>
            <Select
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value)}
            >
              <SelectTrigger className="!py-4">
                <SelectValue
                  placeholder={t("settings:preferencesPage.selectViewMode")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="board">
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="h-4 w-4 mr-1" />
                    <span className="text-xs font-normal">
                      {t("settings:preferencesPage.board")}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="list">
                  <div className="flex items-center gap-3">
                    <List className="h-4 w-4 mr-1" />
                    <span className="text-xs font-normal">
                      {t("settings:preferencesPage.list")}
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.compactMode")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.compactModeDescription")}
              </p>
            </div>
            <Switch checked={compactMode} onCheckedChange={setCompactMode} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.sidebarDefault")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.sidebarDefaultDescription")}
              </p>
            </div>
            <Switch
              checked={sidebarDefaultOpen}
              onCheckedChange={setSidebarDefaultOpen}
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-md font-medium">
              {t("settings:preferencesPage.displayOptions")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("settings:preferencesPage.displayOptionsDescription")}
            </p>
          </div>
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

        <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.taskNumbers")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.taskNumbersDescription")}
              </p>
            </div>
            <Switch
              checked={showTaskNumbers}
              onCheckedChange={setShowTaskNumbers}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.assignees")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.assigneesDescription")}
              </p>
            </div>
            <Switch
              checked={showAssignees}
              onCheckedChange={setShowAssignees}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.dueDates")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.dueDatesDescription")}
              </p>
            </div>
            <Switch checked={showDueDates} onCheckedChange={setShowDueDates} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.labels")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.labelsDescription")}
              </p>
            </div>
            <Switch checked={showLabels} onCheckedChange={setShowLabels} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.priority")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.priorityDescription")}
              </p>
            </div>
            <Switch checked={showPriority} onCheckedChange={setShowPriority} />
          </div>
        </div>
      </div>
    </div>
  );
}
