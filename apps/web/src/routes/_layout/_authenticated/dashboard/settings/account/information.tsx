import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/settings/profile/profile-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/information",
)({
  component: ProfilePage,
});
