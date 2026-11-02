import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { ContactOptionsSettings } from "@/components/settings/contact-options/contact-options-settings";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/contacts",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("settings:workspaceContacts.pageTitle")} />
      <ContactOptionsSettings />
    </>
  );
}
