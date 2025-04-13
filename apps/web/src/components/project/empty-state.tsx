import { motion } from "framer-motion";
import { LayoutGrid, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import CreateProjectModal from "../shared/modals/create-project-modal";

function EmptyProjectState() {
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

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
              animate={{ rotate: 360 }}
              transition={{
                duration: 20,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
            >
              <LayoutGrid className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
            </motion.div>
            <motion.div
              className="absolute -top-2 -right-2"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="w-5 h-5 text-indigo-400 dark:text-indigo-300" />
            </motion.div>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Create Your First Project
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-md mb-8">
            Start organizing your tasks and collaborating with your team by
            creating your first project.
          </p>
        </div>

        <div className="space-y-4">
          <motion.div
            className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                <Plus className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  New Project
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Create a project to organize your tasks
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateProjectOpen(true)}
              className="w-full px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors font-medium inline-flex items-center justify-center gap-2 text-sm"
            >
              Create Project
            </button>
          </motion.div>
        </div>
      </motion.div>
      <CreateProjectModal
        open={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
      />
    </div>
  );
}

export default EmptyProjectState;
