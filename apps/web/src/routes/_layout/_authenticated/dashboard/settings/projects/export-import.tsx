import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/export-import",
)({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="p-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Export / Import</h1>
        <p className="text-muted-foreground mb-6">
          Export your project data or import from other sources.
        </p>

        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Data Management</h2>
            <p className="text-muted-foreground">
              Export and import your project data here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
