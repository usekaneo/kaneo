import { format, isValid, parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import { DatePickerMenu } from "@/components/common/date-picker/date-picker-menu";

type DateFieldEditorProps = {
  name: string;
  value: string;
  required: boolean;
  onSelect: (value: string) => void;
};

export function DateFieldEditor({
  name,
  value,
  required,
  onSelect,
}: DateFieldEditorProps) {
  const { t } = useTranslation();
  const parsed = value ? parseISO(value) : null;
  const selected = parsed && isValid(parsed) ? parsed : null;

  return (
    <DatePickerMenu
      label={name}
      placeholder={t("tasks:datePicker.datePlaceholder")}
      clearLabel={t("tasks:customFields.clear")}
      value={selected}
      onChange={(date) => onSelect(date ? format(date, "yyyy-MM-dd") : "")}
      canClear={!required && selected !== null}
    />
  );
}
