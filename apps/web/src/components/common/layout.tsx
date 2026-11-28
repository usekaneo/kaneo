import type React from "react";
import { type ReactNode, useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { DemoAlert } from "@/components/demo-alert";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { isDemoMode } from "@/constants/urls";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useUserPreferencesEffects } from "@/hooks/use-user-preferences-effects";
import { cn } from "@/lib/cn";
import { useBackgroundStore } from "@/store/background";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { hasShellEntered, markShellEntered } from "./shell-entered";
import { useShellReveal } from "./use-shell-reveal";

type LayoutProps = {
  children: ReactNode;
  className?: string;
};

type HeaderProps = {
  children: ReactNode;
  className?: string;
};

type ContentProps = {
  children: ReactNode;
  className?: string;
};

function LayoutHeader({ children, className }: HeaderProps) {
  return (
    <header
      className={cn(
        "flex h-10 shrink-0 gap-2 transition-[width,height] ease-in-out group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-8 border-b border-border bg-card p-2",
        className,
      )}
    >
      {children}
    </header>
  );
}

function LayoutContent({ children, className }: ContentProps) {
  return (
    <div className={cn("flex-1 min-h-0", className)}>
      <div className="h-full">{children}</div>
    </div>
  );
}

function Layout({ children, className }: LayoutProps) {
  const { sidebarDefaultOpen } = useUserPreferencesStore();
  const { background } = useBackgroundStore();
  const [isEntering] = useState(() => !hasShellEntered());
  const { data: workspace } = useActiveWorkspace();
  const isRevealed = useShellReveal(isEntering, !!workspace);

  useUserPreferencesEffects();

  useEffect(markShellEntered, []);

  return (
    <div
      className={cn(
        "flex w-full bg-background",
        isEntering && (isRevealed ? "shell-reveal" : "shell-pending"),
      )}
    >
      <SidebarProvider
        defaultOpen={sidebarDefaultOpen}
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 60)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar />
        <SidebarInset
          className={cn(
            "m-2 flex flex-1 flex-col overflow-auto rounded-xl border border-border/80 bg-background shadow-sm/5",
            {
              "before:content-[''] before:absolute before:inset-0 before:bg-cover before:bg-center before:bg-(image:--bg) before:pointer-events-none":
                background,
            },
            className,
          )}
          style={{
            // @ts-expect-error variables are not typed by React
            "--bg": `url(${background})`,
          }}
        >
          {isDemoMode && <DemoAlert />}
          {children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

Layout.Header = LayoutHeader;
Layout.Content = LayoutContent;

export default Layout;
