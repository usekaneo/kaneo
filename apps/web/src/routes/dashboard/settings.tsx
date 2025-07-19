import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return <Outlet />;
}
