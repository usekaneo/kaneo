import { useNavigate } from "@tanstack/react-router";
import {
  Folder,
  FolderInput,
  FolderOutput,
  Forward,
  LinkIcon,
  MoreHorizontal,
  Settings,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import icons from "@/constants/project-icons";
import { toast } from "@/lib/toast";

type RowProject = {
  id: string;
  name: string;
  icon: string | null;
};

type GroupTarget = { id: string; name: string; icon: string | null };

export function ProjectRow({
  project,
  workspaceId,
  isActive,
  canDelete,
  onOpen,
  onDelete,
  onRemoveFromGroup,
  groupTargets,
  onMoveIntoGroup,
}: {
  project: RowProject;
  workspaceId: string;
  isActive: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onDelete: () => void;
  /** Set only for child rows the viewer may regroup. */
  onRemoveFromGroup?: () => void;
  /** Projects this row can be nested into; empty or unset hides the item. */
  groupTargets?: GroupTarget[];
  onMoveIntoGroup?: (parentProjectId: string) => void;
}) {
  const { t } = useTranslation();
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const ProjectIcon = icons[project.icon as keyof typeof icons] || icons.Layout;

  return (
    <>
      <SidebarMenuButton
        isActive={isActive}
        size="default"
        className="h-8 text-sm"
        onClick={onOpen}
      >
        <ProjectIcon aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
      </SidebarMenuButton>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              // The row is the drag source; this press must not reach it.
              onPointerDown={(event) => event.stopPropagation()}
              className="absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-lg p-0 text-sidebar-foreground outline-hidden ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground after:-inset-2 after:absolute md:after:hidden peer-data-[size=sm]/menu-button:top-1 peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 group-data-[collapsible=icon]:hidden group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-popup-open:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0"
            />
          }
        >
          <MoreHorizontal />
          <span className="sr-only">{t("navigation:sidebar.more")}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="min-w-44 rounded-lg"
          side={isMobile ? "bottom" : "right"}
          align={isMobile ? "end" : "start"}
        >
          <DropdownMenuItem
            className="h-7 items-start cursor-pointer text-sm"
            onClick={onOpen}
          >
            <Folder className="text-muted-foreground" />
            <span>{t("navigation:projectList.viewProject")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-7 items-start cursor-pointer text-sm"
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}/dashboard/workspace/${workspaceId}/project/${project.id}`,
              );
              toast.success(t("navigation:projectList.linkCopied"), {
                icon: LinkIcon,
              });
            }}
          >
            <Forward className="text-muted-foreground" />
            <span>{t("navigation:projectList.shareProject")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-7 items-start cursor-pointer text-sm"
            onClick={() => {
              navigate({
                to: "/dashboard/settings/projects/$projectId/general",
                params: { projectId: project.id },
              });
            }}
          >
            <Settings className="text-muted-foreground" />
            <span>{t("navigation:projectList.projectSettings")}</span>
          </DropdownMenuItem>
          {onMoveIntoGroup && groupTargets && groupTargets.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-7 cursor-pointer text-sm">
                <FolderInput className="text-muted-foreground" />
                <span>{t("navigation:projectList.moveIntoGroup")}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 min-w-40 rounded-lg">
                {groupTargets.map((target) => {
                  const TargetIcon =
                    icons[target.icon as keyof typeof icons] || icons.Layout;
                  return (
                    <DropdownMenuItem
                      key={target.id}
                      className="h-7 cursor-pointer text-sm"
                      onClick={() => onMoveIntoGroup(target.id)}
                    >
                      <TargetIcon className="text-muted-foreground" />
                      <span className="truncate">{target.name}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {onRemoveFromGroup && (
            <DropdownMenuItem
              className="h-7 items-start cursor-pointer text-sm"
              onClick={onRemoveFromGroup}
            >
              <FolderOutput className="text-muted-foreground" />
              <span>{t("navigation:projectList.removeFromGroup")}</span>
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="h-7 items-start text-destructive cursor-pointer text-sm"
                onClick={onDelete}
              >
                <Trash2 className="text-destructive" />
                <span>{t("navigation:projectList.deleteProject")}</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
