import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useUserPreferencesEffects } from "@/hooks/use-user-preferences-effects";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type React from "react";

interface LayoutProps {
  children: ReactNode;
}

interface HeaderProps {
  children: ReactNode;
}

interface ContentProps {
  children: ReactNode;
}

function LayoutHeader({ children }: HeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex h-10 shrink-0 gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-8 border-b border-border bg-card p-2"
    >
      {children}
    </motion.header>
  );
}

function LayoutContent({ children }: ContentProps) {
  return (
    <div className="flex-1 min-h-0">
      <div className="h-full">{children}</div>
    </div>
  );
}

function Layout({ children }: LayoutProps) {
  const { sidebarDefaultOpen } = useUserPreferencesStore();

  useUserPreferencesEffects();

  return (
    <div className="flex w-full bg-sidebar">
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
        <SidebarInset className="flex-1 flex flex-col overflow-auto bg-card border border-border rounded-md m-2">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

Layout.Header = LayoutHeader;
Layout.Content = LayoutContent;

export default Layout;
