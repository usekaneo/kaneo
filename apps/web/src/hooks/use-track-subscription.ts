import { useEffect } from "react";
import { takePendingPurchase } from "@/lib/analytics/pending-purchase";
import { subscriptionRevenue } from "@/lib/analytics/subscription-revenue";
import { track } from "@/lib/analytics/track";

export function useTrackSubscription(
  checkout: string | undefined,
  seats: number | undefined,
) {
  useEffect(() => {
    if (checkout !== "success" || seats === undefined) return;
    const purchase = takePendingPurchase();
    if (!purchase) return;
    track("Subscribed", {
      props: purchase,
      revenue: subscriptionRevenue(purchase.plan, purchase.interval, seats),
    });
  }, [checkout, seats]);
}
