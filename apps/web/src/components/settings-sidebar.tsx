import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  SheetDescription,
  SheetHeader,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

export default function SettingsSidebar({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: workspace } = useActiveWorkspace();

  return (
    <>
      <aside className="hidden w-64 shrink-0 md:block">{children}</aside>
      <SheetPopup
        side="left"
        className="w-64 bg-sidebar p-0 text-sidebar-foreground md:hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t("common:sidebar.title")}</SheetTitle>
          <SheetDescription>
            {t("common:sidebar.mobileDescription")}
          </SheetDescription>
        </SheetHeader>
        <div className="border-b border-sidebar-border p-2 pr-14">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sm font-normal"
            onClick={() =>
              navigate({
                to: "/dashboard/workspace/$workspaceId",
                params: { workspaceId: workspace?.id ?? "" },
              })
            }
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            {t("navigation:page.backToWorkspace")}
          </Button>
        </div>
        {children}
      </SheetPopup>
    </>
  );
}
