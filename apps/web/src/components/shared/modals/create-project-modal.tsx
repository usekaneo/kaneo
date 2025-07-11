import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import icons from "@/constants/project-icons";
import useCreateProject from "@/hooks/mutations/project/use-create-project";
import { cn } from "@/lib/cn";
import generateProjectSlug from "@/lib/generate-project-id";
import useWorkspaceStore from "@/store/workspace";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

type CreateProjectModalProps = {
  open: boolean;
  onClose: () => void;
};

function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("Layout");
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceStore();
  const { mutateAsync } = useCreateProject({
    name,
    slug,
    workspaceId: workspace?.id ?? "",
    icon: selectedIcon,
  });
  const IconComponent = icons[selectedIcon as keyof typeof icons];
  const navigate = useNavigate();

  const handleClose = () => {
    setName("");
    setSlug("");
    setSelectedIcon("Layout");
    setIconPopoverOpen(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const { id } = await mutateAsync();
      toast.success("Project created successfully");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });

      navigate({
        to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
        params: {
          workspaceId: workspace?.id ?? "",
          projectId: id,
        },
      });

      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create project",
      );
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    setSlug(generateProjectSlug(newName));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-md bg-white dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-xl shadow-2xl"
        showCloseButton={false}
      >
        <DialogHeader className="border-b border-zinc-200 dark:border-zinc-800/50 pb-4 mb-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="text-zinc-600 dark:text-zinc-400 font-semibold tracking-wider text-sm">
                {workspace?.name?.toUpperCase() || "WORKSPACE"}
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="text-zinc-700 dark:text-zinc-300 font-medium text-sm">
                Create a new project
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Popover
              open={iconPopoverOpen}
              onOpenChange={setIconPopoverOpen}
              modal={true}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-center p-2 rounded border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                >
                  <IconComponent className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-2" align="start">
                <div className="max-h-[300px] overflow-y-auto">
                  <div className="grid grid-cols-8 gap-2">
                    {Object.entries(icons).map(([iconName, Icon]) => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => {
                          setSelectedIcon(iconName);
                          setIconPopoverOpen(false);
                        }}
                        className={cn(
                          "p-2 rounded-lg transition-all duration-200 flex items-center justify-center group hover:scale-105",
                          selectedIcon === iconName
                            ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700",
                        )}
                        title={iconName}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Input
              value={name}
              onChange={handleNameChange}
              autoFocus
              placeholder="Project name"
              className="!text-2xl font-semibold !border-0 px-0 py-2 !shadow-none focus-visible:!ring-0 !bg-transparent text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-400 tracking-tight focus:!outline-none focus-visible:!outline-none"
              required
            />
          </div>

          <div>
            <label
              htmlFor="project-key"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-300 mb-2"
            >
              Project Key
            </label>
            <Input
              id="project-key"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="PRO"
              className="bg-zinc-50 dark:bg-zinc-800/30 border-zinc-300 dark:border-zinc-700/30"
              required
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 opacity-60">
              This key will be used for ticket IDs (e.g., ABC-123)
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-800/50">
            <Button
              type="button"
              onClick={handleClose}
              className="bg-transparent border border-zinc-300 dark:border-zinc-700/50 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:hover:border-zinc-600 transition-all duration-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !slug.trim()}
              className="bg-indigo-600 text-white hover:bg-indigo-500 transition-all duration-200 disabled:opacity-50"
            >
              Create Project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateProjectModal;
