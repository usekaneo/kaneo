import { useTranslation } from "react-i18next";
import type { GitlabTokenType } from "@/components/project/gitlab-integration/gitlab-access";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type GitlabTokenTypeSelectProps = {
  id?: string;
  value: GitlabTokenType;
  disabled?: boolean;
  onChange: (value: GitlabTokenType) => void;
};

export function GitlabTokenTypeSelect({
  id,
  value,
  disabled = false,
  onChange,
}: GitlabTokenTypeSelectProps) {
  const { t } = useTranslation();
  const label = (type: GitlabTokenType) =>
    type === "bearer"
      ? t("settings:gitlabIntegration.tokenTypeBearer")
      : t("settings:gitlabIntegration.tokenTypePrivate");

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next === "private" || next === "bearer") onChange(next);
      }}
    >
      <SelectTrigger
        id={id}
        className="w-full"
        aria-label={t("settings:gitlabIntegration.tokenTypeLabel")}
      >
        <SelectValue>{label(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="private">{label("private")}</SelectItem>
        <SelectItem value="bearer">{label("bearer")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
