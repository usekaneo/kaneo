import TanStackRouterDevtools from "@/tanstack/router";
import type { LoggedInUser } from "@/types/user";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  Outlet,
  createRootRouteWithContext,
  redirect,
} from "@tanstack/react-router";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user: LoggedInUser | null | undefined;
}>()({
  component: RootComponent,
  async beforeLoad({ context: { user }, location }) {
    const isRouteUnprotected = location.pathname.includes("auth");
    const isOnDashboard = location.pathname.includes("dashboard");

    if (user === null && !isRouteUnprotected) {
      throw redirect({
        to: "/auth/sign-in",
      });
    }

    if (user && !isOnDashboard) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
});

function RootComponent() {
  return (
    <>
      <div className="flex w-full h-svh overflow-x-hidden overflow-y-hidden flex-row bg-zinc-50 dark:bg-zinc-950 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
        <Outlet />
      </div>
      <ReactQueryDevtools buttonPosition="top-right" />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  );
}

export default RootComponent;
