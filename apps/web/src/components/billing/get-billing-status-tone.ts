import type { StatusTone } from "@/components/settings/status-badge";
import {
  BILLING_STATUS_VARIANT,
  type BillingStatusVariant,
} from "@/constants/billing";

const TONE_BY_VARIANT: Record<BillingStatusVariant, StatusTone> = {
  success: "success",
  warning: "warning",
  error: "destructive",
  secondary: "neutral",
};

export function getBillingStatusTone(status: string): StatusTone {
  const variant = BILLING_STATUS_VARIANT[status];
  return variant ? TONE_BY_VARIANT[variant] : "neutral";
}
