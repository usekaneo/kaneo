import type { TFunction } from "i18next";

export function payrollStatusLabel(t: TFunction, status: string) {
  switch (status) {
    case "approved":
      return t("pay:status.approved");
    case "paid":
      return t("pay:status.paid");
    default:
      return t("pay:status.draft");
  }
}

export function payrollStatusVariant(status: string) {
  if (status === "paid") return "success" as const;
  if (status === "approved") return "info" as const;
  return "outline" as const;
}

export function monthLabel(locale: string, year: number, month: number) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 15)));
}
