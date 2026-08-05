import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  SheetDescription,
  SheetHeader,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";

const SettingsWorkspaceIdContext = createContext<string | undefined>(undefined);

export function SettingsSidebarProvider({
  children,
  workspaceId,
}: {
  children: ReactNode;
  workspaceId?: string;
}): ReactElement {
  return (
    <SettingsWorkspaceIdContext.Provider value={workspaceId}>
      {children}
    </SettingsWorkspaceIdContext.Provider>
  );
}

export default function SettingsSidebar({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const workspaceId = useContext(SettingsWorkspaceIdContext);

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
            disabled={!workspaceId}
            className="w-full justify-start text-sm font-normal"
            onClick={() => {
              if (!workspaceId) return;

              navigate({
                to: "/dashboard/workspace/$workspaceId",
                params: { workspaceId },
              });
            }}
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
