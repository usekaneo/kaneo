import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Palette } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col md:flex-row h-screen">
      <motion.div
        className="md:hidden border-b border-zinc-200 dark:border-zinc-800 p-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          className="flex items-center gap-2 group"
        >
          <Menu className="w-4 h-4 transition-transform duration-200 ease-in-out group-hover:rotate-90" />
          <span>
            {isMobileNavOpen
              ? t("settings.close_menu", { defaultValue: "Close Menu" })
              : t("settings.menu", { defaultValue: "Menu" })}
          </span>
        </Button>
      </motion.div>

      <AnimatePresence mode="wait">
        {(isMobileNavOpen || window.innerWidth >= 768) && (
          <motion.aside
            initial={{
              x: -50,
              opacity: 0,
            }}
            animate={{
              x: 0,
              opacity: 1,
            }}
            exit={{
              x: -50,
              opacity: 0,
            }}
            transition={{
              duration: 0.2,
              ease: "easeOut",
            }}
            className={cn(
              "border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800",
              "md:w-64 bg-white dark:bg-zinc-950",
              "md:block",
              isMobileNavOpen ? "block" : "hidden",
            )}
          >
            <div className="p-4 md:p-6">
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4"
              >
                {t("settings.title", { defaultValue: "Settings" })}
              </motion.h2>
              <nav className="space-y-1">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Link
                    to="/dashboard/settings/appearance"
                    onClick={() => setIsMobileNavOpen(false)}
                    className={cn(
                      "flex items-center px-3 py-2 rounded-lg text-sm transition-colors",
                      pathname.includes("/appearance")
                        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                    )}
                  >
                    <Palette className="w-4 h-4 mr-3" />
                    {t("settings.appearance", { defaultValue: "Appearance" })}
                  </Link>
                </motion.div>
              </nav>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <motion.div
        className="flex-1 overflow-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Outlet />
      </motion.div>
    </div>
  );
}
