import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import icons from "@/constants/project-icons";
import useCreateProject from "@/hooks/mutations/project/use-create-project";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { cn } from "@/lib/cn";
import generateProjectSlug from "@/lib/generate-project-id";
import { toast } from "@/lib/toast";

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
  const { data: workspace } = useActiveWorkspace();
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
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader className="pb-6">
          <DialogTitle asChild>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="text-muted-foreground font-semibold tracking-wider text-sm">
                  {workspace?.name?.toUpperCase() || "WORKSPACE"}
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="text-foreground font-medium text-sm">
                  Create a new project
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Create a new project in your workspace by providing a name, key, and
            selecting an icon.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 px-6">
            <Popover
              open={iconPopoverOpen}
              onOpenChange={setIconPopoverOpen}
              modal={true}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-center p-2 rounded border border-border hover:bg-accent transition-colors"
                >
                  <IconComponent className="w-4 h-4 text-muted-foreground" />
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
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground hover:bg-accent",
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
              className="!text-2xl font-semibold !border-0 px-0 py-3 !shadow-none focus-visible:!ring-0 !bg-transparent text-foreground placeholder:text-muted-foreground tracking-tight focus:!outline-none focus-visible:!outline-none"
              required
            />
          </div>

          <div className="space-y-4 px-6">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Key:
                </span>
                <Input
                  id="project-key"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="PRO"
                  className="w-20 h-8 text-center font-semibold text-sm bg-background border-border rounded-lg transition-all duration-200"
                  required
                />
              </div>
              <div className="flex-1 text-xs text-muted-foreground opacity-80">
                Used for ticket IDs (e.g., {slug || "ABC"}-123)
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              size="sm"
              className="border-border text-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !slug.trim()}
              size="sm"
              className="bg-primary hover:bg-primary/90  disabled:opacity-50"
            >
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateProjectModal;
