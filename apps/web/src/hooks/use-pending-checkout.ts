import { useEffect, useRef } from "react";
import { useCreateCheckout } from "@/hooks/mutations/billing/use-billing-actions";
import { useGetBilling } from "@/hooks/queries/billing/use-get-billing";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { clearCheckoutIntent, readCheckoutIntent } from "@/lib/checkout-intent";

/**
 * Completes a pricing-page deep link: once a new user lands in a workspace,
 * if they arrived via `?checkout=<plan>-<interval>` and the workspace can be
 * billed, redirect them straight into Creem checkout instead of making them
 * find the billing page. No-ops (and clears the intent) when it doesn't apply.
 */
export function usePendingCheckout() {
  const { data: workspace } = useActiveWorkspace();
  const { data: config } = useGetConfig();
  const { data: billing } = useGetBilling(workspace?.id);
  const { isAdmin, isCheckingPermissions } = useWorkspacePermission();
  const checkout = useCreateCheckout(workspace?.id);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    if (!readCheckoutIntent()) return;

    // Wait until everything needed to decide has loaded.
    if (!config || !workspace?.id || !billing || isCheckingPermissions) return;

    handled.current = true;

    const intent = readCheckoutIntent();
    clearCheckoutIntent();

    const alreadyBilled =
      billing.foundingFree || Boolean(billing.plan && billing.status);
    if (!intent || !config.billingEnabled || alreadyBilled || !isAdmin) {
      return;
    }

    checkout.mutate({ plan: intent.plan, interval: intent.interval });
  }, [
    config,
    workspace?.id,
    billing,
    isAdmin,
    isCheckingPermissions,
    checkout,
  ]);
}
