import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft } from "lucide-react";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings",
)({
  component: SettingsLayout,
});

function SettingsLayout() {
  const navigate = useNavigate();
  const { data: workspace } = useActiveWorkspace();

  return (
    <div className="flex flex-col gap-4 p-4 bg-sidebar w-full h-full">
      <div className="flex flex-col gap-4 bg-card h-full border border-border rounded-md p-4">
        {/* back to workspace */}
        <div className="">
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

          <Tabs defaultValue="account" className="w-[400px] pt-2">
            <TabsList className="bg-sidebar gap-2">
              <TabsTrigger
                className="[&[data-state=active]]:border [&[data-state=active]]:border-border [&[data-state=active]]:rounded-md [&[data-state=active]]:bg-card"
                value="account"
                onClick={() => navigate({ to: "/dashboard/settings/account" })}
              >
                Account
              </TabsTrigger>
              <TabsTrigger
                value="workspace"
                className="[&[data-state=active]]:border [&[data-state=active]]:border-border [&[data-state=active]]:rounded-md [&[data-state=active]]:bg-card"
                onClick={() =>
                  navigate({ to: "/dashboard/settings/workspace" })
                }
              >
                Workspace
              </TabsTrigger>
              <TabsTrigger
                value="project"
                className="[&[data-state=active]]:border [&[data-state=active]]:border-border [&[data-state=active]]:rounded-md [&[data-state=active]]:bg-card"
                onClick={() => navigate({ to: "/dashboard/settings/projects" })}
              >
                Projects
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Outlet />
      </div>
    </div>
  );
}
