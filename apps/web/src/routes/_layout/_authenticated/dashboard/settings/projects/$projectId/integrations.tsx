import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Github, MessageCircle, Webhook } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { DiscordIntegrationSettings } from "@/components/project/discord-integration-settings";
import { GitHubIntegrationSettings } from "@/components/project/github-integration-settings";
import { SlackIntegrationSettings } from "@/components/project/slack-integration-settings";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/integrations",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();

  return (
    <>
      <PageTitle title={t("settings:projectIntegrations.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:projectIntegrations.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:projectIntegrations.subtitle")}
          </p>
        </div>

        <div className="space-y-6">
          <IntegrationSection
            defaultOpen
            icon={<Github className="size-4" />}
            subtitle={t("settings:projectIntegrations.githubSectionSubtitle")}
            title={t("settings:projectIntegrations.githubSectionTitle")}
          >
            <GitHubIntegrationSettings projectId={projectId} />
          </IntegrationSection>

          <IntegrationSection
            icon={<MessageCircle className="size-4" />}
            subtitle={t("settings:projectIntegrations.discordSectionSubtitle")}
            title={t("settings:projectIntegrations.discordSectionTitle")}
          >
            <DiscordIntegrationSettings projectId={projectId} />
          </IntegrationSection>

          <IntegrationSection
            icon={<Webhook className="size-4" />}
            subtitle={t("settings:projectIntegrations.slackSectionSubtitle")}
            title={t("settings:projectIntegrations.slackSectionTitle")}
          >
            <SlackIntegrationSettings projectId={projectId} />
          </IntegrationSection>
        </div>
      </div>
    </>
  );
}

function IntegrationSection({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible
      className="rounded-xl border border-border bg-background"
      defaultOpen={defaultOpen}
    >
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-4 px-4 py-4 text-left">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 text-muted-foreground">{icon}</div>
          <div className="min-w-0">
            <h2 className="text-md font-medium">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t border-border p-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
