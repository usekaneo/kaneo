import { Inbox, LayoutPanelLeft, CircleCheck, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { PreviewAvatars } from "./preview-avatars";
import { type PreviewFocus, previewFocusClassName } from "./preview-focus";

type PreviewSidebarProps = {
  workspaceName: string;
  projectName: string | null;
  focus: PreviewFocus;
  ownerInitial: string;
  invitedInitials: string[];
  emptySeats: number;
  showMembers: boolean;
};

const rowClassName =
  "flex h-7 items-center gap-2 rounded-md px-2 text-[13px] text-sidebar-foreground transition-[background-color,box-shadow] duration-300";

export function PreviewSidebar({
  workspaceName,
  projectName,
  focus,
  ownerInitial,
  invitedInitials,
  emptySeats,
  showMembers,
}: PreviewSidebarProps) {
  const { t } = useTranslation();
  const initial = Array.from(workspaceName.trim())[0]?.toUpperCase() ?? "";

  return (
    <div className="flex w-52 shrink-0 flex-col gap-4 px-2.5 py-3">
      <div
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg px-2 transition-[background-color,box-shadow] duration-300",
          focus === "workspace" ? previewFocusClassName : "bg-accent",
        )}
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-foreground font-semibold text-[11px] text-background">
          {initial}
        </span>
        <span className="truncate font-medium text-[13px] text-foreground">
          {workspaceName}
        </span>
        {focus === "workspace" ? (
          <span className="-ms-1.5 h-3.5 w-px shrink-0 animate-caret-blink bg-foreground" />
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <div className={rowClassName}>
          <Inbox className="size-3.5" />
          {t("navigation:sidebar.inbox")}
        </div>
        <div className={rowClassName}>
          <CircleCheck className="size-3.5" />
          {t("navigation:sidebar.myTasks")}
        </div>
        <div
          className={cn(
            rowClassName,
            focus === "members" && previewFocusClassName,
          )}
        >
          <Users className="size-3.5" />
          {t("navigation:sidebar.members")}
          {showMembers ? (
            <PreviewAvatars
              ownerInitial={ownerInitial}
              invitedInitials={invitedInitials}
              emptySeats={emptySeats}
            />
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex h-6 items-center px-2 text-sidebar-foreground/70 text-xs">
          {t("navigation:sidebar.projects")}
        </div>
        {projectName !== null ? (
          <div
            className={cn(
              rowClassName,
              "text-foreground",
              focus === "project" ? previewFocusClassName : "bg-accent",
            )}
          >
            <LayoutPanelLeft className="size-3.5" />
            <span className="truncate">{projectName}</span>
          </div>
        ) : (
          <div className="flex h-7 items-center gap-2 rounded-md bg-muted/40 px-2">
            <span className="size-3.5 rounded bg-muted" />
            <span className="h-2 w-24 rounded bg-muted" />
          </div>
        )}
      </div>
    </div>
  );
}
