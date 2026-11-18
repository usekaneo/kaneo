import { ChevronDown, Rocket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGetSprints } from "@/hooks/queries/sprint/use-get-sprints";
import type { SprintScope } from "./sprint-scope";

type SprintScopeSelectProps = {
  projectId: string;
  scope: SprintScope;
  onChange: (scope: SprintScope) => void;
};

// Which sprint the board is scoped to: the active sprint by default, with
// all sprints, the backlog, or any single sprint a click away.
export function SprintScopeSelect({
  projectId,
  scope,
  onChange,
}: SprintScopeSelectProps) {
  const { t } = useTranslation();
  const { data: sprints = [] } = useGetSprints(projectId);
  // Closed sprints are history and cannot take new board work.
  const selectableSprints = sprints.filter(
    (sprint) => sprint.status !== "closed",
  );

  const labelFor = (candidate: SprintScope): string => {
    if (candidate === "current") return t("tasks:sprints.scopeCurrent");
    if (candidate === "all") return t("tasks:boardFilters.allSprints");
    if (candidate === "backlog") return t("tasks:sprints.backlog");
    return (
      sprints.find((sprint) => sprint.id === candidate)?.name ??
      t("tasks:boardFilters.allSprints")
    );
  };

  const title = t("tasks:sprints.scopeTitle");

  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={title}
                  className="h-7 gap-1.5 px-2 text-xs font-medium text-muted-foreground data-popup-open:bg-accent data-popup-open:text-foreground"
                />
              }
            />
          }
        >
          <Rocket className="size-3.5" />
          <span className="max-w-28 truncate">{labelFor(scope)}</span>
          <ChevronDown className="size-3 opacity-60" />
        </TooltipTrigger>
        <TooltipContent>{title}</TooltipContent>
      </Tooltip>
      <MenuPopup align="start" className="min-w-44">
        <MenuRadioGroup
          value={scope}
          onValueChange={(value) => onChange(value as SprintScope)}
        >
          <MenuRadioItem value="current">
            {t("tasks:sprints.scopeCurrent")}
          </MenuRadioItem>
          <MenuRadioItem value="all">
            {t("tasks:boardFilters.allSprints")}
          </MenuRadioItem>
          <MenuRadioItem value="backlog">
            {t("tasks:sprints.backlog")}
          </MenuRadioItem>
          {selectableSprints.length > 0 && <MenuSeparator />}
          {selectableSprints.map((sprint) => (
            <MenuRadioItem key={sprint.id} value={sprint.id}>
              <span className="max-w-44 truncate">{sprint.name}</span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}
