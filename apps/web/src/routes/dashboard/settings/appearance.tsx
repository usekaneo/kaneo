import { SettingsLayout, SettingsSection } from "@/components/settings-layout";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Calendar,
  Eye,
  Flag,
  Hash,
  Layout,
  Monitor,
  Moon,
  Sun,
  Tag,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/settings/appearance")({
  component: UserSettings,
});

function UserSettings() {
  const {
    theme: selectedTheme,
    setTheme,
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
  } = useUserPreferencesStore();

  return (
    <SettingsLayout
      title="User"
      className="pt-4 px-6"
      description="Customize your personal preferences and appearance"
    >
      <SettingsSection
        title="Theme"
        description="Choose your preferred color scheme"
        icon={<Sun className="w-4 h-4" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              id: "light",
              name: "Light",
              icon: Sun,
              description: "Light mode for bright environments",
              preview: "bg-white border-zinc-200",
            },
            {
              id: "dark",
              name: "Dark",
              icon: Moon,
              description: "Dark mode for low-light environments",
              preview: "bg-zinc-900 border-zinc-700",
            },
            {
              id: "system",
              name: "System",
              icon: Monitor,
              description: "Follows your system preferences",
              preview:
                "bg-gradient-to-br from-white to-zinc-900 border-zinc-400",
            },
          ].map((theme) => (
            <motion.button
              key={theme.id}
              onClick={() => {
                setTheme(theme.id as "dark" | "light" | "system");
              }}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative overflow-hidden rounded-lg border-2 p-4 text-left transition-all duration-200",
                selectedTheme === theme.id
                  ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                  : "border-border bg-card hover:border-primary/50 hover:shadow-sm",
              )}
            >
              {selectedTheme === theme.id && (
                <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                  <svg
                    className="h-3 w-3 text-primary-foreground"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-label="Selected"
                  >
                    <title>Selected</title>
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}

              <div className="space-y-3">
                <div
                  className={cn("h-12 w-full rounded-md border", theme.preview)}
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <theme.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{theme.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {theme.description}
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Layout & Interface"
        description="Customize how the interface looks and behaves"
        icon={<Layout className="w-4 h-4" />}
      >
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Layout className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Compact Mode</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reduce spacing and padding for a denser layout
                </p>
              </div>
              <Switch checked={compactMode} onCheckedChange={setCompactMode} />
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Display Preferences"
        description="Control what information is shown in your tasks"
        icon={<Eye className="w-4 h-4" />}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            {
              id: "taskNumbers",
              label: "Task Numbers",
              description: "Show task ID numbers (e.g., PROJ-123)",
              icon: Hash,
              checked: showTaskNumbers,
              onChange: setShowTaskNumbers,
            },
            {
              id: "assignees",
              label: "Assignees",
              description: "Show who is assigned to each task",
              icon: Users,
              checked: showAssignees,
              onChange: setShowAssignees,
            },
            {
              id: "priority",
              label: "Priority",
              description: "Show task priority indicators",
              icon: Flag,
              checked: showPriority,
              onChange: setShowPriority,
            },
            {
              id: "dueDates",
              label: "Due Dates",
              description: "Show task due dates and deadlines",
              icon: Calendar,
              checked: showDueDates,
              onChange: setShowDueDates,
            },
            {
              id: "labels",
              label: "Labels",
              description: "Show task labels and tags",
              icon: Tag,
              checked: showLabels,
              onChange: setShowLabels,
            },
          ].map((setting) => (
            <div key={setting.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <setting.icon className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">
                      {setting.label}
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {setting.description}
                  </p>
                </div>
                <Switch
                  checked={setting.checked}
                  onCheckedChange={setting.onChange}
                />
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>
    </SettingsLayout>
  );
}
