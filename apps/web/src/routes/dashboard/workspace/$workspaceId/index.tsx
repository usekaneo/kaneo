import WorkspaceLayout from "@/components/common/workspace-layout";
import CreateProjectModal from "@/components/shared/modals/create-project-modal";
import { Button } from "@/components/ui/button";
import { KbdSequence } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { shortcuts } from "@/constants/shortcuts";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/workspace/$workspaceId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  const handleCreateProject = () => {
    setIsCreateProjectOpen(true);
  };

  useRegisterShortcuts({
    sequentialShortcuts: {
      [shortcuts.project.prefix]: {
        [shortcuts.project.create]: handleCreateProject,
      },
    },
  });

  return (
    <>
      <WorkspaceLayout
        title="Dashboard"
        onCreateProject={handleCreateProject}
        headerActions={
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateProject}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New project
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="flex items-center gap-2">
                  Create project
                  <KbdSequence
                    keys={[shortcuts.project.prefix, shortcuts.project.create]}
                  />
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
      >
        <div>Dashboard content will go here!</div>
      </WorkspaceLayout>

      <CreateProjectModal
        open={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
      />
    </>
  );
}
