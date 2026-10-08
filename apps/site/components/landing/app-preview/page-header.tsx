import { PanelLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { MOCK_WORKSPACE } from "./mock-data";

// The header of apps/web's workspace-layout: workspace / page, then actions.
export function PreviewPageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border bg-card p-2">
      <div className="flex w-full items-center gap-1">
        <span className="-ml-1 flex size-6 items-center justify-center text-foreground">
          <PanelLeftIcon aria-hidden="true" className="size-4" />
        </span>
        <div className="mx-1.5 h-4 w-px shrink-0 bg-border/80" />
        <Breadcrumb className="flex w-full items-center gap-1 text-xs">
          <BreadcrumbList>
            <BreadcrumbItem>
              <span className="text-xs font-normal text-card-foreground">
                {MOCK_WORKSPACE.name}
              </span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <span className="text-xs font-normal text-card-foreground">
                {title}
              </span>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {actions && <div className="flex items-center gap-1.5">{actions}</div>}
    </header>
  );
}
