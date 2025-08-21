import { useUserPreferencesStore } from "@/store/user-preferences";
import type { User } from "@/types/user";
import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { Toaster } from "sonner";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user: User | null | undefined;
}>()({
  component: RootComponent,
});

function RootComponent() {
  const { theme } = useUserPreferencesStore();

  return (
    <>
      <div className="flex w-full h-svh overflow-x-hidden overflow-y-hidden flex-row scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900 bg-sidebar">
        <Outlet />
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
