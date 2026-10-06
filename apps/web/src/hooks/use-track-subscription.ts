import { useEffect } from "react";
import { takePendingPurchase } from "@/lib/analytics/pending-purchase";
import { subscriptionRevenueUsd } from "@/lib/analytics/subscription-revenue";
import { track } from "@/lib/analytics/track";

export function useTrackSubscription(
  checkout: string | undefined,
  seats: number | undefined,
) {
  useEffect(() => {
    if (checkout !== "success" || seats === undefined) return;
    const purchase = takePendingPurchase();
    if (!purchase) return;
    const revenue = subscriptionRevenueUsd(
      purchase.plan,
      purchase.interval,
      seats,
    );
    track("Subscribed", {
      props: {
        ...purchase,
        ...(revenue === undefined ? {} : { revenue_usd: revenue }),
      },
    });
  }, [checkout, seats]);
}
