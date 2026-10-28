import { createFileRoute, Outlet } from "@tanstack/react-router";
import { usePendingCheckout } from "@/hooks/use-pending-checkout";

export const Route = createFileRoute("/_layout/_authenticated/dashboard")({
  component: DashboardLayoutComponent,
});

function DashboardLayoutComponent() {
  usePendingCheckout();

  return <Outlet />;
}
