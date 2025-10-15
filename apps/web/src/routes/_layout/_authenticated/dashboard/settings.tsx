import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings",
)({
  component: SettingsLayout,
});

function SettingsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
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

  return (
    <>
      <PageTitle title="Settings" />
      <div className="flex flex-col gap-4 p-4 bg-sidebar w-full h-full">
        <div className="flex flex-col gap-4 bg-card h-full border border-border rounded-md p-4 relative overflow-hidden">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate({
                  to: "/dashboard/workspace/$workspaceId",
                  params: { workspaceId: workspace?.id ?? "" },
                })
              }
            >
              <ChevronLeft className=" border border-border rounded-md p-1 size-6" />
              Back to Workspace
            </Button>

            <h1 className="text-2xl font-bold pl-2 mt-2">Settings</h1>

            <Tabs value={activeTab} className="w-[400px] pt-2">
              <TabsList className="bg-sidebar gap-2">
                <TabsTrigger
                  className="[&[data-state=active]]:border [&[data-state=active]]:border-border [&[data-state=active]]:rounded-md [&[data-state=active]]:bg-card"
                  value="account"
                  onClick={() =>
                    navigate({ to: "/dashboard/settings/account/information" })
                  }
                >
                  Account
                </TabsTrigger>
                <TabsTrigger
                  value="workspace"
                  className="[&[data-state=active]]:border [&[data-state=active]]:border-border [&[data-state=active]]:rounded-md [&[data-state=active]]:bg-card"
                  onClick={() =>
                    navigate({ to: "/dashboard/settings/workspace/general" })
                  }
                >
                  Workspace
                </TabsTrigger>
                <TabsTrigger
                  disabled={projects?.length === 0}
                  value="project"
                  className="[&[data-state=active]]:border [&[data-state=active]]:border-border [&[data-state=active]]:rounded-md [&[data-state=active]]:bg-card"
                  onClick={() =>
                    navigate({ to: "/dashboard/settings/projects" })
                  }
                >
                  Projects
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </div>
      </div>
    </>
  );
}
