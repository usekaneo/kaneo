import { createFileRoute } from "@tanstack/react-router";
import { BillingSettingsPage } from "@/components/billing/billing-settings-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/billing",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    checkout: typeof search.checkout === "string" ? search.checkout : undefined,
  }),
});

function RouteComponent() {
  const { checkout } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <BillingSettingsPage
      checkout={checkout}
      onDismissCheckout={() =>
        navigate({ search: { checkout: undefined }, replace: true })
      }
    />
  );
}
