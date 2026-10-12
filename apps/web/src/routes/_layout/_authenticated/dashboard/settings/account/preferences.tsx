import { createFileRoute } from "@tanstack/react-router";
import { PreferencesPage } from "@/components/settings/preferences/preferences-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/preferences",
)({
  component: PreferencesPage,
});
