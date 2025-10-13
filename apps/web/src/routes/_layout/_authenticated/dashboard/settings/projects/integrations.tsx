import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/integrations",
)({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="p-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Project Integrations</h1>
        <p className="text-muted-foreground mb-6">
          Connect your project with external tools and services.
        </p>

        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">
              Available Integrations
            </h2>
            <p className="text-muted-foreground">
              Manage your project integrations here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
