import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/device")({
  component: DeviceLayout,
});

function DeviceLayout() {
  return <Outlet />;
}
