import Layout from "@/components/common/layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { KbdSequence } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { shortcuts } from "@/constants/shortcuts";
import { cn } from "@/lib/cn";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

interface SettingsLayoutProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  backPath?: string;
  backLabel?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsLayout({
  title,
  description,
  backPath,
  backLabel = "Back",
  children,
  className,
}: SettingsLayoutProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backPath) {
      navigate({ to: backPath });
    } else {
      window.history.back();
    }
  };

  return (
    <Layout>
      <Layout.Header>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1 w-full">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="-ml-1 h-6 w-6" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="flex items-center gap-2 text-xs">
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
            <Separator
              orientation="vertical"
              className="mx-1.5 data-[orientation=vertical]:h-2.5"
            />
            <Breadcrumb className="flex items-center gap-1 text-xs w-full">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard/settings">
                    <h1 className="text-xs text-card-foreground">Settings</h1>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <h1 className="text-xs text-card-foreground">{title}</h1>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-1.5">
            {backPath && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="gap-1.5 text-xs"
              >
                <ArrowLeft className="w-3 h-3" />
                {backLabel}
              </Button>
            )}
          </div>
        </div>
      </Layout.Header>
      <Layout.Content>
        <div className={cn("max-w-4xl mx-auto space-y-8 py-6", className)}>
          {description && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          )}
          {children}
        </div>
      </Layout.Content>
    </Layout>
  );
}

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  icon,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-background">
            {icon}
          </div>
        )}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

interface DangerZoneSectionProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function DangerZoneSection({
  title,
  description,
  children,
}: DangerZoneSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-destructive">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
        {children}
      </div>
    </div>
  );
}
