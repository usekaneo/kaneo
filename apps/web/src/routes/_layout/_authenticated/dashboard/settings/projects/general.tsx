import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/general",
)({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="p-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Project Settings</h1>
        <p className="text-muted-foreground mb-6">
          Manage your project settings and preferences.
        </p>

        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">General Information</h2>
            <p className="text-muted-foreground">
              Configure basic project settings here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
