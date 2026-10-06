import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  type BillingInterval,
  type BillingPlan,
  createBillingCheckout,
  createBillingPortal,
} from "@/fetchers/billing/create-checkout";
import { savePendingPurchase } from "@/lib/analytics/pending-purchase";
import { track } from "@/lib/analytics/track";

export function useCreateCheckout(workspaceId: string | undefined) {
  return useMutation({
    mutationFn: (input: { plan: BillingPlan; interval: BillingInterval }) =>
      createBillingCheckout({ workspaceId: workspaceId as string, ...input }),
    onSuccess: ({ checkoutUrl }, { plan, interval }) => {
      track("Checkout Started", { props: { plan, interval } });
      savePendingPurchase({ plan, interval });
      window.location.href = checkoutUrl;
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Could not start checkout",
      );
    },
  });
}

export function useOpenBillingPortal(workspaceId: string | undefined) {
  return useMutation({
    mutationFn: () => createBillingPortal(workspaceId as string),
    onSuccess: ({ portalUrl }) => {
      window.location.href = portalUrl;
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not open billing portal",
      );
    },
  });
}
