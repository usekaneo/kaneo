import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import Layout from "@/components/common/layout";
import PageTitle from "@/components/page-title";
import { MarkdownRenderer } from "@/components/public-project/markdown-renderer";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { developerGuideMarkdown } from "@/content/developer-guide";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/developer-guide",
)({
  component: DeveloperGuidePage,
});

function DeveloperGuidePage() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("developerGuide:pageTitle")} />
      <Layout>
        <Layout.Header>
          <div className="flex items-center gap-1 w-full">
            <SidebarTrigger className="-ml-1 h-6 w-6" />
            <Separator
              orientation="vertical"
              className="mx-1.5 data-[orientation=vertical]:h-2.5"
            />
            <h1 className="text-xs text-card-foreground">
              {t("developerGuide:heading")}
            </h1>
          </div>
        </Layout.Header>
        <Layout.Content>
          <div className="mx-auto w-full max-w-3xl px-6 py-8">
            <p className="mb-6 text-sm text-muted-foreground">
              {t("developerGuide:subtitle")}
            </p>
            <MarkdownRenderer content={developerGuideMarkdown} />
          </div>
        </Layout.Content>
      </Layout>
    </>
  );
}
