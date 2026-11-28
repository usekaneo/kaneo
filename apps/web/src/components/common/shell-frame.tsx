import { cn } from "@/lib/cn";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function ShellFrame() {
  const sidebarOpen = useUserPreferencesStore(
    (state) => state.sidebarDefaultOpen,
  );

  return (
    <div aria-hidden="true" className="flex h-svh w-full bg-sidebar">
      {sidebarOpen ? <div className="hidden w-60 shrink-0 md:block" /> : null}
      <div
        className={cn(
          "m-2 flex-1 rounded-xl border border-border/80 bg-background shadow-sm/5",
          sidebarOpen && "md:ms-0",
        )}
      />
    </div>
  );
}
