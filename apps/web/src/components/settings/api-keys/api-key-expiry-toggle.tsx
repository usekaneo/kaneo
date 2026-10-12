import { useTranslation } from "react-i18next";
import {
  API_KEY_EXPIRATIONS,
  type ApiKeyExpiration,
  isApiKeyExpiration,
} from "@/components/settings/api-keys/api-key-expirations";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ApiKeyExpiryToggleProps = {
  value: ApiKeyExpiration;
  onChange: (value: ApiKeyExpiration) => void;
  labelledBy: string;
  disabled?: boolean;
};

export function ApiKeyExpiryToggle({
  value,
  onChange,
  labelledBy,
  disabled,
}: ApiKeyExpiryToggleProps) {
  const { t } = useTranslation();

  return (
    <ToggleGroup
      aria-labelledby={labelledBy}
      value={[value]}
      onValueChange={([next]) => {
        if (isApiKeyExpiration(next)) onChange(next);
      }}
      disabled={disabled}
      className="h-9 w-full rounded-lg border border-input bg-background p-0.5 sm:h-8 dark:bg-input/32"
    >
      {API_KEY_EXPIRATIONS.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          size="sm"
          className="h-full flex-1 text-muted-foreground data-pressed:text-foreground sm:h-full"
        >
          {t(option.labelKey)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
