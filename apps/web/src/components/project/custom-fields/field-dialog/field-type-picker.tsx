import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { useTranslation } from "react-i18next";
import { FIELD_KINDS } from "@/components/project/custom-fields/field-kinds";
import type { FieldKind } from "@/components/project/custom-fields/types";
import { RadioGroup } from "@/components/ui/radio-group";

type FieldTypePickerProps = {
  value: FieldKind;
  labelledBy: string;
  disabled: boolean;
  onChange: (kind: FieldKind) => void;
};

export function FieldTypePicker({
  value,
  labelledBy,
  disabled,
  onChange,
}: FieldTypePickerProps) {
  const { t } = useTranslation();

  return (
    <RadioGroup
      value={value}
      disabled={disabled}
      aria-labelledby={labelledBy}
      onValueChange={(next) => onChange(next as FieldKind)}
      className="grid grid-cols-3 gap-2 sm:grid-cols-5"
    >
      {FIELD_KINDS.map(({ kind, icon: Icon }) => (
        <RadioPrimitive.Root
          key={kind}
          value={kind}
          className="flex h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-input bg-background text-xs text-muted-foreground outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:border-foreground/40 data-checked:bg-accent data-checked:font-medium data-checked:text-foreground data-disabled:cursor-not-allowed data-disabled:hover:bg-background data-disabled:not-data-checked:opacity-50 dark:bg-input/32 dark:data-checked:bg-input/64"
        >
          <Icon aria-hidden="true" className="size-4" />
          {t(`settings:customFields.types.${kind}`)}
        </RadioPrimitive.Root>
      ))}
    </RadioGroup>
  );
}
