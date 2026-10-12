import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RepositoryPathInputProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  invalid: boolean;
  disabled?: boolean;
  browseDisabled: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
  onBrowse: () => void;
};

export function RepositoryPathInput({
  id,
  label,
  value,
  placeholder,
  invalid,
  disabled = false,
  browseDisabled,
  onChange,
  onBlur,
  onBrowse,
}: RepositoryPathInputProps) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        className="min-w-0 flex-1 font-mono text-xs sm:text-xs"
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      <Button
        type="button"
        variant="outline"
        className="w-24 shrink-0"
        disabled={browseDisabled}
        onClick={onBrowse}
      >
        {t("settings:codeHosting.browse")}
      </Button>
    </div>
  );
}
