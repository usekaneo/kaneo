import { motion } from "framer-motion";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";

function SelectProjectState() {
  const { t } = useTranslation();
  return (
    <div className="flex w-full items-center justify-center h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <motion.div
        className="max-w-md w-full px-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-center mb-8">
          <div className="relative w-16 h-16 mb-4 mx-auto">
            <motion.div
              className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center"
              animate={{ x: [0, 10, 0] }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            >
              <LayoutGrid className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
            </motion.div>
            <motion.div
              className="absolute -left-4 top-1/2 -translate-y-1/2"
              animate={{ x: [0, 5, 0] }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
                delay: 0.5,
              }}
            >
              <ArrowLeft className="w-5 h-5 text-indigo-400 dark:text-indigo-300" />
            </motion.div>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            {t("select_a_project", { defaultValue: "Select a Project" })}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-md">
            {t(
              "choose_a_project_from_the_sidebar_to_view_its_kanban_board_and_start_managing_your_tasks",
              {
                defaultValue:
                  "Choose a project from the sidebar to view its kanban board and start managing your tasks.",
              },
            )}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default SelectProjectState;
