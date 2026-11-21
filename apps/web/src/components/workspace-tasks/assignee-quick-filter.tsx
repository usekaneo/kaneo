import { Check, UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MemberFilterAvatar } from "@/components/project/task-filters/member-filter-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UNASSIGNED_ASSIGNEE_FILTER } from "@/hooks/use-task-filters";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/get-initials";
import {
  arrangeQuickFilterMembers,
  type QuickFilterMember,
} from "./quick-filter-members";

type AssigneeQuickFilterProps = {
  members: QuickFilterMember[];
  selected: string[];
  onToggle: (userId: string) => void;
  currentUserId?: string;
};

const avatarButtonClass = (isSelected: boolean, dimmed: boolean) =>
  cn(
    "shrink-0 rounded-full ring-2 transition-[opacity,box-shadow] duration-150 hover:opacity-100 focus-visible:outline-none focus-visible:ring-ring",
    isSelected
      ? "ring-primary"
      : cn("ring-transparent hover:ring-border", dimmed && "opacity-50"),
  );

export default function AssigneeQuickFilter({
  members,
  selected,
  onToggle,
  currentUserId,
}: AssigneeQuickFilterProps) {
  const { t } = useTranslation();
  if (members.length === 0) return null;

  const { visible, overflow } = arrangeQuickFilterMembers(
    members,
    selected,
    currentUserId,
  );
  const dimmed = selected.length > 0;
  const unassignedLabel = t("tasks:boardFilters.unassigned");
  const isUnassignedSelected = selected.includes(UNASSIGNED_ASSIGNEE_FILTER);

  return (
    <TooltipProvider>
      <div
        role="group"
        aria-label={t("tasks:boardFilters.quickFilterLabel")}
        className="hidden items-center gap-1 sm:inline-flex"
      >
        {visible.map((member) => {
          const name = member.user?.name || t("common:people.unknown");
          const isSelected = selected.includes(member.userId);
          return (
            <Tooltip key={member.userId}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={name}
                    onClick={() => onToggle(member.userId)}
                    className={avatarButtonClass(isSelected, dimmed)}
                  />
                }
              >
                <Avatar className="size-6">
                  <AvatarImage src={member.user?.image ?? ""} alt="" />
                  <AvatarFallback className="border border-border/30 text-[10px] font-medium">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>{name}</TooltipContent>
            </Tooltip>
          );
        })}
        {overflow.length > 0 && (
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label={t("tasks:boardFilters.moreMembers", {
                    count: overflow.length,
                  })}
                  title={t("tasks:boardFilters.moreMembers", {
                    count: overflow.length,
                  })}
                  className={avatarButtonClass(false, false)}
                />
              }
            >
              <Avatar className="size-6">
                <AvatarFallback className="border border-border/30 text-[10px] font-medium">
                  +{overflow.length}
                </AvatarFallback>
              </Avatar>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1">
              <ul className="max-h-72 overflow-y-auto">
                {overflow.map((member) => {
                  const name = member.user?.name || t("common:people.unknown");
                  return (
                    <li key={member.userId}>
                      <button
                        type="button"
                        aria-pressed={false}
                        onClick={() => onToggle(member.userId)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                      >
                        <span aria-hidden="true" className="flex shrink-0">
                          <MemberFilterAvatar
                            name={member.user?.name}
                            image={member.user?.image}
                          />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-left">
                          {name}
                        </span>
                        <Check
                          className="size-3.5 opacity-0"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </PopoverContent>
          </Popover>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-pressed={isUnassignedSelected}
                aria-label={unassignedLabel}
                onClick={() => onToggle(UNASSIGNED_ASSIGNEE_FILTER)}
                className={avatarButtonClass(isUnassignedSelected, dimmed)}
              />
            }
          >
            <Avatar className="size-6">
              <AvatarFallback className="border border-dashed border-border bg-muted text-muted-foreground">
                <UserX className="size-3" />
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>{unassignedLabel}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
