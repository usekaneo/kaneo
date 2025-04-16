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

  const themes = [
    {
      id: "light",
      name: t("appearance.theme_light", { defaultValue: "Light" }),
      icon: Sun,
      description: t("appearance.theme_light_desc", {
        defaultValue: "Light mode for bright environments",
      }),
    },
    {
      id: "dark",
      name: t("appearance.theme_dark", { defaultValue: "Dark" }),
      icon: Moon,
      description: t("appearance.theme_dark_desc", {
        defaultValue: "Dark mode for low-light environments",
      }),
    },
    {
      id: "system",
      name: t("appearance.theme_system", { defaultValue: "System" }),
      icon: Monitor,
      description: t("appearance.theme_system_desc", {
        defaultValue: "Follows your system preferences",
      }),
    },
  ];

  return (
    <>
      <PageTitle
        title={t("appearance.page_title", {
          defaultValue: "Appearance Settings",
        })}
      />
      <div className="w-full p-4 md:p-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 md:space-y-8"
        >
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {t("appearance.title", { defaultValue: "Appearance" })}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {t("appearance.subtitle", {
                defaultValue: "Customize how Kaneo looks on your device.",
              })}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 md:p-6">
              <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                {t("appearance.theme", { defaultValue: "Theme" })}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 md:mb-6">
                {t("appearance.theme_desc", {
                  defaultValue:
                    "Select your preferred theme for Kaneo's interface.",
                })}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {themes.map((theme) => (
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
                {t("appearance.interface_prefs", {
                  defaultValue: "Interface Preferences",
                })}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 md:mb-6">
                {t("appearance.interface_prefs_desc", {
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
                      {t("appearance.sidebar_nav", {
                        defaultValue: "Sidebar navigation",
                      })}
                    </label>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {t("appearance.sidebar_nav_desc", {
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
