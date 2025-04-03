import PageTitle from "@/components/page-title";
import useTheme from "@/components/providers/theme-provider/hooks/use-theme";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
export const Route = createFileRoute("/dashboard/settings/appearance")({
  component: AppearanceSettings,
});

function AppearanceSettings() {
  const { theme: selectedTheme, setTheme: setSelectedTheme } = useTheme();
  const { isSidebarOpened, setIsSidebarOpened } = useUserPreferencesStore();
  const { t } = useTranslation();
  return (
    <>
      <PageTitle title="Appearance Settings" />
      <div className="w-full p-4 md:p-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 md:space-y-8"
        >
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {t("appearance", { defaultValue: "Appearance" })}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {t("customize_how_kaneo_looks_on_your_device", {
                defaultValue: "Customize how Kaneo looks on your device.",
              })}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 md:p-6">
              <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                {t("theme", { defaultValue: "Theme" })}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 md:mb-6">
                {t("select_your_preferred_theme_for_kaneo_s_interface", {
                  defaultValue:
                    "Select your preferred theme for Kaneo's interface.",
                })}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {[
                  {
                    id: "light",
                    name: "Light",
                    icon: Sun,
                    description: "Light mode for bright environments",
                  },
                  {
                    id: "dark",
                    name: "Dark",
                    icon: Moon,
                    description: "Dark mode for low-light environments",
                  },
                  {
                    id: "system",
                    name: "System",
                    icon: Monitor,
                    description: "Follows your system preferences",
                  },
                ].map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => {
                      setSelectedTheme(theme.id as "dark" | "light" | "system");
                    }}
                    type="button"
                    className={cn(
                      "relative p-4 rounded-lg border transition-all duration-200 text-left",
                      selectedTheme === theme.id
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                        : "border-zinc-200 dark:border-zinc-800 bg-white hover:border-zinc-300 dark:bg-zinc-900 dark:hover:border-zinc-700",
                    )}
                  >
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-2 mb-2">
                        <theme.icon
                          className={cn(
                            "w-5 h-5",
                            selectedTheme === theme.id
                              ? "text-indigo-500 dark:text-indigo-400"
                              : "text-zinc-500 dark:text-zinc-400",
                          )}
                        />
                        <span
                          className={cn(
                            "font-medium",
                            selectedTheme === theme.id
                              ? "text-indigo-500 dark:text-indigo-400"
                              : "text-zinc-900 dark:text-zinc-100",
                          )}
                        >
                          {theme.name}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {theme.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 md:p-6">
              <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                {t("interface_preferences", {
                  defaultValue: "Interface Preferences",
                })}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 md:mb-6">
                {t("customize_your_interface_preferences", {
                  defaultValue: "Customize your interface preferences.",
                })}
              </p>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <label
                      htmlFor="sidebar-navigation"
                      className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
                    >
                      {t("sidebar_navigation", {
                        defaultValue: "Sidebar navigation",
                      })}
                    </label>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {t("show_or_hide_the_sidebar", {
                        defaultValue: "Show or hide the sidebar",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <Switch
                      id="sidebar-navigation"
                      checked={isSidebarOpened}
                      onCheckedChange={() => setIsSidebarOpened()}
                      className="data-[state=checked]:bg-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
