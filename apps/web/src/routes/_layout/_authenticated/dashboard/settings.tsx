import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { ChevronLeft, PanelLeftIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { SettingsSidebarProvider } from "@/components/SettingsSidebar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings",
)({
  component: SettingsLayout,
});

function SettingsLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const { data: workspace } = useActiveWorkspace();
  const { data: projects } = useGetProjects({
    workspaceId: workspace?.id ?? "",
  });

  const getActiveTab = () => {
    const pathname = location.pathname;
    if (pathname.includes("/dashboard/settings/account")) {
      return "account";
    }
    if (pathname.includes("/dashboard/settings/workspace")) {
      return "workspace";
    }
    if (pathname.includes("/dashboard/settings/projects")) {
      return "project";
    }
    return "account";
  };

  const activeTab = getActiveTab();

  useEffect(() => {
    if (location.pathname) {
      setSettingsMenuOpen(false);
    }
  }, [location.pathname]);

  useLayoutEffect(() => {
    if (!isMobile) {
      setSettingsMenuOpen(false);
    }
  }, [isMobile]);

  return (
    <>
      <PageTitle title={t("navigation:page.settingsTitle")} />

      <div className="flex h-full w-full flex-col bg-sidebar p-2 sm:p-4">
        <div className="relative flex h-full min-h-0 flex-col gap-6 overflow-hidden rounded-md border border-border bg-card p-3 md:gap-4 sm:p-4">
          <div className="shrink-0">
            <div className="flex items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 md:hidden"
                aria-label="Open settings menu"
                title="Open settings menu"
                onClick={() => setSettingsMenuOpen(true)}
              >
                <PanelLeftIcon className="size-4" />
              </Button>

              <div className="flex items-center gap-1 md:hidden">
                <ChevronLeft className="size-4 text-muted-foreground" />
                <span className="text-lg font-semibold">
                  {t("navigation:page.settingsTitle")}
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                disabled={!workspace?.id}
                className="hidden md:inline-flex"
                onClick={() => {
                  if (!workspace?.id) return;

                  navigate({
                    to: "/dashboard/workspace/$workspaceId",
                    params: { workspaceId: workspace.id },
                  });
                }}
              >
                <ChevronLeft />

                {t("navigation:page.backToWorkspace")}
              </Button>
            </div>

            <h1 className="mt-4 hidden pl-1 text-2xl font-semibold md:block">
              {t("navigation:page.settingsTitle")}
            </h1>

            <Tabs
              value={activeTab}
              className="w-full pt-4 md:w-[400px] md:pt-2"
            >
              <TabsList className="bg-sidebar gap-2">
                <TabsTrigger
                  value="account"
                  className="[&[data-state=active]]:rounded-md [&[data-state=active]]:border [&[data-state=active]]:border-border [&[data-state=active]]:bg-card"
                  onClick={() =>
                    navigate({
                      to: "/dashboard/settings/account/information",
                    })
                  }
                >
                  {t("settings:account")}
                </TabsTrigger>
                <TabsTrigger
                  value="workspace"
                  className="[&[data-state=active]]:rounded-md [&[data-state=active]]:border [&[data-state=active]]:border-border [&[data-state=active]]:bg-card"
                  onClick={() =>
                    navigate({
                      to: "/dashboard/settings/workspace/general",
                    })
                  }
                >
                  {t("navigation:page.settingsWorkspaceTab")}
                </TabsTrigger>
                <TabsTrigger
                  disabled={projects?.length === 0}
                  value="project"
                  className="[&[data-state=active]]:rounded-md [&[data-state=active]]:border [&[data-state=active]]:border-border [&[data-state=active]]:bg-card"
                  onClick={() =>
                    navigate({
                      to: "/dashboard/settings/projects",
                    })
                  }
                >
                  {t("navigation:sidebar.projects")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <SettingsSidebarProvider
              workspaceId={workspace?.id}
              menuOpen={settingsMenuOpen}
              setMenuOpen={setSettingsMenuOpen}
            >
              <Outlet />
            </SettingsSidebarProvider>
          </div>
        </div>
      </div>
    </>
  );
}
