import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import icons from "@/constants/project-icons";
import useCreateProject from "@/hooks/mutations/project/use-create-project";
import useDeleteProject from "@/hooks/mutations/project/use-delete-project";
import useGetProjectTemplates from "@/hooks/queries/project/use-get-project-templates";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import generateProjectSlug from "@/lib/generate-project-id";
import { toast } from "@/lib/toast";

type CreateProjectModalProps = {
  open: boolean;
  onClose: () => void;
  mode?: "create" | "duplicate" | "template";
  sourceProject?: { id: string; name: string; icon: string | null };
};

function CreateProjectModal({
  open,
  onClose,
  mode = "create",
  sourceProject,
}: CreateProjectModalProps) {
  const { t } = useTranslation();
  const title =
    mode === "duplicate"
      ? t("common:modals.createProject.duplicateTitle")
      : mode === "template"
        ? t("common:modals.createProject.templateTitle")
        : t("common:modals.createProject.title");
  const initialName = sourceProject
    ? t(
        mode === "duplicate"
          ? "common:modals.createProject.duplicateName"
          : "common:modals.createProject.templateName",
        { name: sourceProject.name },
      )
    : "";
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(() => generateProjectSlug(initialName));
  const [selectedIcon, setSelectedIcon] = useState(
    sourceProject?.icon ?? "Layout",
  );
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [includeTasks, setIncludeTasks] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const queryClient = useQueryClient();
  const { data: workspace } = useActiveWorkspace();
  const {
    data: templates,
    isError: templatesFailed,
    refetch: refetchTemplates,
  } = useGetProjectTemplates({
    workspaceId: workspace?.id ?? "",
    enabled: open && mode === "create",
  });
  const { canDeleteProjects } = useWorkspacePermission();
  const { mutateAsync, isPending: isCreating } = useCreateProject();
  const { mutateAsync: deleteProject, isPending: isDeleting } =
    useDeleteProject();
  const SelectedIcon =
    icons[selectedIcon as keyof typeof icons] || icons.Layout;
  const filteredIcons = Object.entries(icons).filter(([iconName]) =>
    iconName.toLowerCase().includes(iconSearch.trim().toLowerCase()),
  );
  const navigate = useNavigate();

  const sourceProjectId =
    mode === "create" ? selectedTemplateId : sourceProject?.id;
  const selectedTemplate = templates?.find(
    (template) => template.id === selectedTemplateId,
  );

  const handleClose = () => {
    setName("");
    setSlug("");
    setSelectedIcon("Layout");
    setIconPopoverOpen(false);
    setIconSearch("");
    setSelectedTemplateId("");
    setIncludeTasks(false);
    setTemplateToDelete(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !workspace?.id || isCreating) return;
    if (mode !== "create" && !sourceProjectId) return;

    try {
      const { id } = await mutateAsync({
        name: name.trim(),
        slug: slug.trim(),
        workspaceId: workspace.id,
        icon: selectedIcon,
        ...(sourceProjectId ? { sourceProjectId, includeTasks } : {}),
        ...(mode === "template" ? { asTemplate: true } : {}),
      });

      if (mode === "template") {
        toast.success(t("common:modals.createProject.templateSuccessToast"));
      } else {
        toast.success(t("common:modals.createProject.successToast"));
        await navigate({
          to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
          params: { workspaceId: workspace.id, projectId: id },
        });
      }
      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:modals.createProject.errorToast"),
      );
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete || !workspace?.id || !canDeleteProjects()) return;

    try {
      await deleteProject({ id: templateToDelete.id });
      if (selectedTemplateId === templateToDelete.id) {
        setSelectedTemplateId("");
        setIncludeTasks(false);
        setSelectedIcon("Layout");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects", workspace.id] }),
        queryClient.invalidateQueries({
          queryKey: ["project-templates", workspace.id],
        }),
      ]);
      toast.success(t("common:modals.createProject.templateDeletedToast"));
      setTemplateToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:modals.createProject.templateDeleteError"),
      );
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    setSlug(generateProjectSlug(newName));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isCreating) handleClose();
      }}
    >
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader className="px-3 pt-4 pb-1 gap-1.5">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <Breadcrumb>
            <BreadcrumbList className="gap-1 text-xs">
              <BreadcrumbItem className="text-muted-foreground font-medium tracking-wide">
                {workspace?.name?.toUpperCase() ||
                  t("common:modals.createProject.workspaceFallback")}
              </BreadcrumbItem>
              <BreadcrumbSeparator className="[&>svg]:size-3.5" />
              <BreadcrumbItem className="text-foreground font-medium">
                {title}
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <DialogDescription className="sr-only">
            {mode === "create"
              ? t("common:modals.createProject.description")
              : mode === "template"
                ? t("common:modals.createProject.templateVisibility")
                : t("common:modals.createProject.copyScope")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-6 px-3 pt-2">
            <Popover
              open={iconPopoverOpen}
              onOpenChange={(open) => {
                setIconPopoverOpen(open);
                if (!open) setIconSearch("");
              }}
              modal={true}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="h-8 w-8 p-0"
                  title={t("common:modals.createProject.pickIcon")}
                >
                  <SelectedIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-2">
                  <Input
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    placeholder={t("common:modals.createProject.searchIcons")}
                    className="h-8 text-xs"
                  />
                  <div className="max-h-[280px] overflow-y-auto pr-1">
                    <div className="grid grid-cols-6 gap-1.5">
                      {filteredIcons.map(([iconName, Icon]) => {
                        const isSelected = selectedIcon === iconName;
                        return (
                          <Button
                            key={iconName}
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedIcon(iconName);
                              setIconPopoverOpen(false);
                              setIconSearch("");
                            }}
                            className={cn(
                              "h-10 items-center justify-center rounded-md p-0",
                              isSelected &&
                                "bg-sidebar-accent text-sidebar-accent-foreground",
                            )}
                            title={iconName}
                          >
                            <Icon className="h-4 w-4" />
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Input
              unstyled
              value={name}
              onChange={handleNameChange}
              autoFocus
              placeholder={t("common:modals.createProject.projectName")}
              className="w-full [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:px-0 [&_[data-slot=input]]:py-2 [&_[data-slot=input]]:text-2xl [&_[data-slot=input]]:leading-tight [&_[data-slot=input]]:font-semibold [&_[data-slot=input]]:tracking-tight [&_[data-slot=input]]:text-foreground [&_[data-slot=input]]:placeholder:text-muted-foreground [&_[data-slot=input]]:outline-none"
              required
            />
          </div>

          <div className="space-y-3 px-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {t("common:modals.createProject.keyLabel")}
                </span>
                <Input
                  id="project-key"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="PRO"
                  maxLength={8}
                  className="w-20 h-8 text-center font-semibold text-sm bg-background border-border rounded-lg transition-colors duration-150"
                  required
                />
              </div>
              <div className="flex-1 text-xs text-muted-foreground opacity-80">
                {t("common:modals.createProject.keyHint", {
                  example: slug || "ABC",
                })}
              </div>
            </div>
            {mode === "create" && (
              <div className="space-y-2">
                <Label htmlFor="project-template">
                  {t("common:modals.createProject.templateSource")}
                </Label>
                <Select
                  value={selectedTemplateId}
                  onValueChange={(value) => {
                    const nextId = String(value ?? "");
                    setSelectedTemplateId(nextId);
                    setIncludeTasks(false);
                    setSelectedIcon(
                      templates?.find((template) => template.id === nextId)
                        ?.icon ?? "Layout",
                    );
                  }}
                >
                  <SelectTrigger id="project-template" className="w-full">
                    <SelectValue
                      placeholder={t("common:modals.createProject.blankSource")}
                    >
                      {selectedTemplate?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">
                      {t("common:modals.createProject.blankSource")}
                    </SelectItem>
                    {templates?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templatesFailed ? (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => refetchTemplates()}
                  >
                    {t("common:modals.createProject.templatesLoadError")}
                  </Button>
                ) : !templates?.length ? (
                  <p className="text-xs text-muted-foreground">
                    {t("common:modals.createProject.noTemplates")}
                  </p>
                ) : null}
                {selectedTemplate && canDeleteProjects() && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-destructive"
                    onClick={() =>
                      setTemplateToDelete({
                        id: selectedTemplate.id,
                        name: selectedTemplate.name,
                      })
                    }
                  >
                    {t("common:modals.createProject.deleteTemplate")}
                  </Button>
                )}
              </div>
            )}
            {sourceProjectId && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t("common:modals.createProject.copyScope")}
                </p>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="project-include-tasks"
                    checked={includeTasks}
                    onCheckedChange={(checked) =>
                      setIncludeTasks(checked === true)
                    }
                  />
                  <Label
                    htmlFor="project-include-tasks"
                    className="min-w-0 flex-col items-start gap-0.5"
                  >
                    <span>{t("common:modals.createProject.includeTasks")}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {t("common:modals.createProject.taskScope")}
                    </span>
                  </Label>
                </div>
              </div>
            )}
            {mode === "template" && (
              <p className="text-xs text-muted-foreground">
                {t("common:modals.createProject.templateVisibility")}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handleClose}
              disabled={isCreating}
              variant="outline"
              size="sm"
              className="border-border text-foreground hover:bg-accent"
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                isCreating ||
                !workspace?.id ||
                !name.trim() ||
                !slug.trim() ||
                (mode !== "create" && !sourceProjectId)
              }
              size="sm"
              className="bg-primary hover:bg-primary/90 disabled:opacity-50"
            >
              {mode === "duplicate"
                ? t("common:modals.createProject.duplicateButton")
                : mode === "template"
                  ? t("common:modals.createProject.templateButton")
                  : t("common:modals.createProject.createButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <AlertDialog
        open={!!templateToDelete}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isDeleting) setTemplateToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("common:modals.createProject.deleteTemplateTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("common:modals.createProject.deleteTemplateDescription", {
                name: templateToDelete?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleDeleteTemplate}
            >
              {t("common:modals.createProject.deleteTemplate")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

export default CreateProjectModal;
