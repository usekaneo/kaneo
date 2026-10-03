import { SyncRulesSection } from "@/components/project/sync-rules/sync-rules-section";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { IntegrationStatus } from "@/components/project/integrations/get-integration-status";
import type { IntegrationDefinition } from "@/components/project/integrations/integration-definitions";
import { IntegrationStatusBadge } from "@/components/project/integrations/integration-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/cn";

type IntegrationRowProps = {
  onRetry: () => void;
  integration: IntegrationDefinition;
  projectId: string;
  status: IntegrationStatus | undefined;
};

export function IntegrationRow({
  integration,
  onRetry,
  projectId,
  status,
}: IntegrationRowProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const name =
    typeof integration.name === "string"
      ? integration.name
      : t(integration.name.key);
  const state = status?.state ?? "loading";
  const isSetUp = state === "connected" || state === "paused";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
          <integration.icon
            aria-hidden="true"
            className={cn("size-4", integration.iconClassName)}
          />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{name}</p>
            <IntegrationStatusBadge state={state} />
          </div>
          {isSetUp && status?.detail ? (
            <p className="truncate font-mono text-xs text-muted-foreground">
              {status.detail}
            </p>
          ) : (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {t(integration.descriptionKey)}
            </p>
          )}
        </div>
        {state === "unavailable" && !open ? (
          <Button
            className="w-24 shrink-0"
            onClick={onRetry}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("common:error.tryAgain")}
          </Button>
        ) : (
          <CollapsibleTrigger
            disabled={state === "loading" && !open}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "w-24 shrink-0",
            })}
          >
            {open
              ? t("settings:projectIntegrations.done")
              : state === "loading"
                ? t("common:empty.loading")
                : isSetUp
                  ? t("settings:projectIntegrations.configure")
                  : t("settings:projectIntegrations.connect")}
          </CollapsibleTrigger>
        )}
      </div>
      <CollapsiblePanel>
        <div className="border-t border-border bg-muted/40 p-4">
          <integration.Settings projectId={projectId} />
          {isSetUp &&
            (integration.id === "github" ||
              integration.id === "gitea" ||
              integration.id === "gitlab") && (
              <div className="mt-4">
                <SyncRulesSection
                  key={`${projectId}:${integration.id}`}
                  projectId={projectId}
                  provider={integration.id}
                />
              </div>
            )}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
