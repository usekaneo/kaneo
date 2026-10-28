import { createFileRoute } from "@tanstack/react-router";
import { PreferencesPage } from "@/components/settings/preferences/preferences-page";
import { prefetchManagedProfileFields } from "@/hooks/queries/user/prefetch-managed-profile-fields";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/preferences",
)({
  loader: {
    handler: ({ context }) =>
      prefetchManagedProfileFields(
        context.queryClient,
        context.session?.user.id,
      ),
    staleReloadMode: "blocking",
  },
  component: PreferencesPage,
});
