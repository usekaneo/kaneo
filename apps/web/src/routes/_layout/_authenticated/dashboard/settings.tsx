import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings",
)({
  component: SettingsLayout,
});

function SettingsLayout() {
  return <Outlet />;
}
