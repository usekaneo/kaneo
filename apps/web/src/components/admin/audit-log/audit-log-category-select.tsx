import { useTranslation } from "react-i18next";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUDIT_LOG_CATEGORIES } from "./audit-log-categories";

type AuditLogCategorySelectProps = {
  value: string;
  onValueChange: (category: string) => void;
};

export function AuditLogCategorySelect({
  value,
  onValueChange,
}: AuditLogCategorySelectProps) {
  const { t } = useTranslation();
  const items = AUDIT_LOG_CATEGORIES.map((category) => ({
    value: category.value,
    label: t(category.labelKey),
  }));
  const selected = items.find((item) => item.value === value) ?? items[0];

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") onValueChange(next);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={t("settings:adminAuditLog.categoryLabel")}
        className="w-full sm:w-44"
      >
        <SelectValue>{selected?.label}</SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {items.map((item) => (
          <SelectItem key={item.value || "all"} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
