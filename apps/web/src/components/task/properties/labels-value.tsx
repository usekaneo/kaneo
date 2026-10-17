import { Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resolveLabelColor } from "@/lib/label-color";

type LabelsValueProps = {
  labels: { id: string; name: string; color: string }[];
};

export function LabelsValue({ labels }: LabelsValueProps) {
  const { t } = useTranslation();

  if (labels.length === 0) {
    return (
      <>
        <Tag className="text-muted-foreground" />
        <span className="truncate text-muted-foreground">
          {t("tasks:properties.addLabels")}
        </span>
      </>
    );
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      {labels.map((label) => (
        <span key={label.id} className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: resolveLabelColor(label.color) }}
          />
          <span className="truncate">{label.name}</span>
        </span>
      ))}
    </span>
  );
}
