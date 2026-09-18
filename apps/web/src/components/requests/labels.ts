import type { TFunction } from "i18next";

export function leaveTypeLabel(t: TFunction, type: string) {
  switch (type) {
    case "sick":
      return t("requests:leave.types.sick");
    case "unpaid":
      return t("requests:leave.types.unpaid");
    default:
      return t("requests:leave.types.annual");
  }
}

export function requestStatusLabel(t: TFunction, status: string) {
  switch (status) {
    case "approved":
      return t("requests:status.approved");
    case "rejected":
      return t("requests:status.rejected");
    case "cancelled":
      return t("requests:status.cancelled");
    case "paid":
      return t("requests:status.paid");
    default:
      return t("requests:status.pending");
  }
}

export function requestStatusVariant(status: string) {
  if (status === "approved" || status === "paid") return "success" as const;
  if (status === "rejected") return "error" as const;
  if (status === "cancelled") return "outline" as const;
  return "warning" as const;
}
