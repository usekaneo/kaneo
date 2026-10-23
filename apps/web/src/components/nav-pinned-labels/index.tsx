import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LabelDot } from "@/components/settings/labels/label-dot";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import useSetLabelPinned from "@/hooks/mutations/label/use-set-label-pinned";
import useGetPinnedLabels from "@/hooks/queries/label/use-get-pinned-labels";
import { toast } from "@/lib/toast";
import {
  groupPinnedLabels,
  type PinnedLabelGroup,
} from "./group-pinned-labels";
import { PinLabelPicker } from "./pin-label-picker";

const GLOBAL_BOARD = "/dashboard/global-board";

// Shortcuts to the global board filtered by one label.
export function NavPinnedLabels() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const search = useSearch({ strict: false }) as { label?: unknown };
  const { data: pins = [] } = useGetPinnedLabels();
  const { mutate: setPinned } = useSetLabelPinned();
  const groups = groupPinnedLabels(pins);

  const isActive = (group: PinnedLabelGroup) =>
    pathname === GLOBAL_BOARD &&
    Array.isArray(search.label) &&
    search.label.length === 1 &&
    String(search.label[0]).toLowerCase() === group.name.toLowerCase();

  const unpin = (group: PinnedLabelGroup) => {
    for (const label of group.pins)
      setPinned(
        { label, pinned: false },
        { onError: () => toast.error(t("navigation:pinnedLabels.error")) },
      );
  };

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup className="group-data-[collapsible=icon]:hidden gap-1 p-2 pt-1">
        <CollapsibleTrigger
          className="data-panel-open:[&_svg]:rotate-90"
          render={
            <SidebarGroupLabel className="h-7 cursor-pointer justify-start gap-1 px-0 text-sidebar-accent-foreground" />
          }
        >
          <span>{t("navigation:pinnedLabels.title")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/60 transition-transform duration-200" />
        </CollapsibleTrigger>
        <PinLabelPicker groups={groups} />
        <CollapsiblePanel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {groups.length === 0 ? (
                <li className="px-2 py-1 text-muted-foreground text-xs">
                  {t("navigation:pinnedLabels.empty")}
                </li>
              ) : (
                groups.map((group) => (
                  <SidebarMenuItem key={group.name.toLowerCase()}>
                    <SidebarMenuButton
                      isActive={isActive(group)}
                      size="default"
                      className="h-8 text-sm"
                      onClick={() =>
                        navigate({
                          to: GLOBAL_BOARD,
                          search: { label: [group.name] },
                        })
                      }
                    >
                      <span className="flex size-4 items-center justify-center">
                        <LabelDot color={group.color} className="size-2" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {group.name}
                      </span>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      showOnHover
                      title={t("navigation:pinnedLabels.unpin", {
                        name: group.name,
                      })}
                      aria-label={t("navigation:pinnedLabels.unpin", {
                        name: group.name,
                      })}
                      onClick={() => unpin(group)}
                    >
                      <X />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsiblePanel>
      </SidebarGroup>
    </Collapsible>
  );
}
