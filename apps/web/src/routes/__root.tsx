import { CommandPalette } from "@/components/command-palette";
import useTheme from "@/components/providers/theme-provider/hooks/use-theme";
import type { LoggedInUser } from "@/types/user";
import type { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  redirect,
} from "@tanstack/react-router";
import { Toaster } from "sonner";

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
  const { theme } = useTheme();

  return (
    <>
      <div className="flex w-full h-svh overflow-x-hidden overflow-y-hidden flex-row bg-zinc-50 dark:bg-zinc-950 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
        <Outlet />
        <CommandPalette />
      </div>
      <Toaster
        position="bottom-right"
        closeButton
        richColors
        theme={theme}
        toastOptions={{
          classNames: {
            toast:
              "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100",
            title: "text-zinc-900 dark:text-zinc-100 text-sm font-medium",
            description: "text-zinc-600 dark:text-zinc-400 text-sm",
            actionButton:
              "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100",
            cancelButton:
              "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100",
            success:
              "!bg-white dark:!bg-zinc-900 border-zinc-200 dark:border-zinc-800",
            error:
              "!bg-white dark:!bg-zinc-900 border-zinc-200 dark:border-zinc-800",
            info: "!bg-white dark:!bg-zinc-900 border-zinc-200 dark:border-zinc-800",
          },
          duration: 2000,
        }}
      />
    </>
  );
}

export default RootComponent;
