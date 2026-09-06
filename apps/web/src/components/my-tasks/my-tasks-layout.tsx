import { useNavigate } from "@tanstack/react-router";
import { CalendarRange, SquareKanban } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Layout from "@/components/common/layout";
import { Button } from "@/components/ui/button";
import { KbdSequence } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { shortcuts } from "@/constants/shortcuts";
import { cn } from "@/lib/cn";

export type MyTasksView = "board" | "calendar";

type MyTasksLayoutProps = {
  activeView: MyTasksView;
  headerActions?: ReactNode;
  children: ReactNode;
};

/**
 * Header for the cross-project "My tasks" pages: no workspace or project crumb
 * because the tasks below may come from several of each.
 */
export default function MyTasksLayout({
  activeView,
  headerActions,
  children,
}: MyTasksLayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const views: Array<{
    key: MyTasksView;
    label: string;
    icon: typeof SquareKanban;
    to: "/dashboard/my-tasks/board" | "/dashboard/my-tasks/calendar";
  }> = [
    {
      key: "board",
      label: t("tasks:title"),
      icon: SquareKanban,
      to: "/dashboard/my-tasks/board",
    },
    {
      key: "calendar",
      label: t("tasks:calendar.title"),
      icon: CalendarRange,
      to: "/dashboard/my-tasks/calendar",
    },
  ];

  return (
    <Layout>
      <Layout.Header className="h-11 border-border/80 px-2">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="-ml-1 h-7 w-7 cursor-pointer text-foreground/85 hover:text-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="flex items-center gap-2 text-[10px]">
                    Toggle sidebar
                    <KbdSequence
                      keys={[
                        shortcuts.sidebar.prefix,
                        shortcuts.sidebar.toggle,
                      ]}
                    />
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="h-4 w-px shrink-0 bg-border/80" />

            <span className="truncate text-xs font-medium text-foreground">
              {t("tasks:myTasks.title")}
            </span>

            <div className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-border/80 bg-background p-0.5">
              {views.map((view) => (
                <Button
                  key={view.key}
                  variant={activeView === view.key ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => navigate({ to: view.to })}
                  className={cn(
                    "h-6 gap-1.5 rounded-md px-2 text-xs",
                    activeView !== view.key && "text-muted-foreground",
                  )}
                >
                  <view.icon className="size-3.5" />
                  {view.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {headerActions}
          </div>
        </div>
      </Layout.Header>

      <Layout.Content>{children}</Layout.Content>
    </Layout>
  );
}
