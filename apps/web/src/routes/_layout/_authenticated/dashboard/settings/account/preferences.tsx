import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, List, RotateCcw } from "lucide-react";
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
import { useUserPreferencesStore } from "@/store/user-preferences";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/preferences",
)({
  component: RouteComponent,
});

function RouteComponent() {
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
        <h1 className="text-2xl font-semibold">Preferences</h1>
        <p className="text-muted-foreground">
          Customize your Kaneo experience.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-md font-medium">Appearance</h2>
          <p className="text-xs text-muted-foreground">
            Visual settings and layout preferences.
          </p>
        </div>

        <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Theme</Label>
              <p className="text-xs text-muted-foreground">
                Choose your preferred color scheme
              </p>
            </div>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="!py-4">
                <SelectValue placeholder="Select a theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-[#F4F4F5] rounded-md p-1 border border-border">
                      <span className="rounded-full size-2 bg-primary" />
                      <span className="text-xs font-normal text-black">Aa</span>
                    </div>
                    <span className="text-xs font-normal">Light</span>
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-[#18181B] rounded-md p-1 border border-border">
                      <span className="rounded-full size-2 bg-primary" />
                      <span className="text-xs font-normal text-white">Aa</span>
                    </div>
                    <span className="text-xs font-normal">Dark</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Default View</Label>
              <p className="text-xs text-muted-foreground">
                Choose your preferred task view mode
              </p>
            </div>
            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="!py-4">
                <SelectValue placeholder="Select a view mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="board">
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="h-4 w-4 mr-1" />
                    <span className="text-xs font-normal">Board</span>
                  </div>
                </SelectItem>
                <SelectItem value="list">
                  <div className="flex items-center gap-3">
                    <List className="h-4 w-4 mr-1" />
                    <span className="text-xs font-normal">List</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Compact Mode</Label>
              <p className="text-xs text-muted-foreground">
                Use reduced spacing for more content
              </p>
            </div>
            <Switch checked={compactMode} onCheckedChange={setCompactMode} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Sidebar Default</Label>
              <p className="text-xs text-muted-foreground">
                Keep sidebar expanded on startup
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
            <h2 className="text-md font-medium">Display options</h2>
            <p className="text-xs text-muted-foreground">
              Choose which information to show in task views
            </p>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={resetDisplayPreferences}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>

        <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Task Numbers</Label>
              <p className="text-xs text-muted-foreground">
                Show task IDs and numbers
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
              <Label className="text-sm font-medium">Assignees</Label>
              <p className="text-xs text-muted-foreground">
                Show who's assigned to tasks
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
              <Label className="text-sm font-medium">Due Dates</Label>
              <p className="text-xs text-muted-foreground">
                Display task deadlines
              </p>
            </div>
            <Switch checked={showDueDates} onCheckedChange={setShowDueDates} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Labels</Label>
              <p className="text-xs text-muted-foreground">
                Show task labels and tags
              </p>
            </div>
            <Switch checked={showLabels} onCheckedChange={setShowLabels} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Priority</Label>
              <p className="text-xs text-muted-foreground">
                Display priority indicators
              </p>
            </div>
            <Switch checked={showPriority} onCheckedChange={setShowPriority} />
          </div>
        </div>
      </div>
    </div>
  );
}
