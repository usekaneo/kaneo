import { Link } from "@tanstack/react-router";
import { ArchiveIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import useAdminAccess from "@/hooks/queries/admin/use-admin-access";

/** Shown in place of a workspace an instance administrator archived. */
export default function WorkspaceArchived() {
  const { t } = useTranslation();
  const { data: isInstanceAdmin } = useAdminAccess();
  const title = t("workspace:archived.title");

  return (
    <Empty className="h-full">
      <PageTitle title={title} />
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ArchiveIcon />
        </EmptyMedia>
        <EmptyTitle role="heading" aria-level={1}>
          {title}
        </EmptyTitle>
        <EmptyDescription>
          {t("workspace:archived.description")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" render={<Link to="/dashboard" />}>
            {t("workspace:archived.otherWorkspaces")}
          </Button>
          {isInstanceAdmin ? (
            <Button render={<Link to="/dashboard/settings/admin/workspaces" />}>
              {t("workspace:archived.manage")}
            </Button>
          ) : null}
        </div>
      </EmptyContent>
    </Empty>
  );
}
