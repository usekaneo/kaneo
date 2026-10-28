import { useTranslation } from "react-i18next";
import { LabelPill } from "@/components/settings/labels/label-pill";

type LabelPreviewProps = {
  name: string;
  color: string;
};

export function LabelPreview({ name, color }: LabelPreviewProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-3">
      <span className="shrink-0 text-muted-foreground text-xs">
        {t("settings:workspaceLabels.preview")}
      </span>
      <LabelPill
        name={name || t("settings:workspaceLabels.previewPlaceholder")}
        color={color}
      />
    </div>
  );
}
