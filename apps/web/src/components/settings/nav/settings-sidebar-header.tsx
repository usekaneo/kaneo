import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Kbd } from "@/components/ui/kbd";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type SettingsSidebarHeaderProps = {
  onLeave: (() => void) | undefined;
};

export function SettingsSidebarHeader({ onLeave }: SettingsSidebarHeaderProps) {
  const { t } = useTranslation();

  return (
    <SidebarHeader className="pt-1 pb-1.5">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            className="h-8 text-sm font-medium text-sidebar-accent-foreground"
            disabled={!onLeave}
            onClick={onLeave}
            aria-label={t("navigation:page.backToWorkspace")}
            title={t("navigation:page.backToWorkspace")}
          >
            <ChevronLeft aria-hidden="true" />
            <span className="flex-1">{t("navigation:page.settingsTitle")}</span>
            <Kbd aria-hidden="true" className="hidden md:inline-flex">
              Esc
            </Kbd>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}
