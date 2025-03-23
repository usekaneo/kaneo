import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Shield, Users } from "lucide-react";
import { Menu } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/teams/$workspaceId/_layout")({
  component: RouteComponent,
});

function RouteComponent() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { workspaceId } = Route.useParams();

  return (
    <>
      <PageTitle title="Team Members" />
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
            <span>{isMobileNavOpen ? "Close Menu" : "Menu"}</span>
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
                "md:block", // Always show on desktop
                isMobileNavOpen ? "block" : "hidden", // Toggle on mobile
              )}
            >
              <div className="p-4 md:p-6">
                <motion.h2
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4"
                >
                  Team
                </motion.h2>
                <nav className="space-y-1">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Link
                      className={cn(
                        "flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200 ease-in-out",
                        pathname.includes("/members")
                          ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                      )}
                      to="/dashboard/teams/$workspaceId/members"
                      params={{
                        workspaceId,
                      }}
                      onClick={() => setIsMobileNavOpen(false)}
                    >
                      <Users className="w-4 h-4 mr-3" />
                      Members
                    </Link>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div
                      className={cn(
                        "flex items-center px-3 py-2 rounded-lg text-sm opacity-50 cursor-not-allowed transition-all duration-200 ease-in-out",
                        "text-zinc-400 dark:text-zinc-600",
                      )}
                    >
                      <Shield className="w-4 h-4 mr-3" />
                      <span className="flex items-center gap-2">
                        Roles
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                          Soon
                        </span>
                      </span>
                    </div>
                  </motion.div>
                </nav>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <motion.div
          className="flex-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="h-full overflow-auto">
            <Outlet />
          </div>
        </motion.div>
      </div>
    </>
  );
}
