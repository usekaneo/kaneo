import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { DatePickerSheet } from "@/components/pickers";
import { MultiSelectSheet, OptionSheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { Button, TextField } from "@/components/ui";
import { formatDate, toIsoDay } from "@/lib/format";

import { selectedDefaults, type CustomFieldType } from "./field-form";

export function CustomFieldDefaultInput({
  type,
  value,
  options,
  onChange,
}: {
  type: CustomFieldType;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation(["mobile"]);
  const [picking, setPicking] = useState(false);
  const label = t("mobile:projectSettings.defaultValue");

  if (type === "text" || type === "number") {
    return (
      <TextField
        label={label}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={type === "number" ? "numbers-and-punctuation" : "default"}
        autoCapitalize="none"
        autoCorrect={false}
      />
    );
  }

  const booleanOptions = [
    { value: "false", label: t("mobile:projectSettings.unchecked") },
    { value: "true", label: t("mobile:projectSettings.checked") },
  ];
  const selected = selectedDefaults(value);
  const display =
    type === "date"
      ? formatDate(value)
      : type === "boolean"
        ? booleanOptions.find((option) => option.value === value)?.label
        : type === "multiselect"
          ? selected.join(", ")
          : value;

  return (
    <View style={{ gap: 8 }}>
      <Txt variant="meta" weight="medium" tone="body">
        {label}
      </Txt>
      <Button
        label={display || t("mobile:projectSettings.chooseDefault")}
        kind="secondary"
        disabled={
          (type === "dropdown" || type === "multiselect") &&
          options.length === 0
        }
        onPress={() => setPicking(true)}
      />
      {type === "date" ? (
        <DatePickerSheet
          visible={picking}
          onClose={() => setPicking(false)}
          title={label}
          value={value}
          onPick={(day) => onChange(day ? toIsoDay(day) : "")}
        />
      ) : type === "multiselect" ? (
        <MultiSelectSheet
          visible={picking}
          onClose={() => setPicking(false)}
          title={label}
          options={options}
          selected={selected.filter((option) => options.includes(option))}
          onSave={(values) => onChange(JSON.stringify(values))}
        />
      ) : (
        <OptionSheet
          visible={picking}
          onClose={() => setPicking(false)}
          title={label}
          options={
            type === "boolean"
              ? booleanOptions
              : options.map((option) => ({ value: option, label: option }))
          }
          selected={value}
          onSelect={onChange}
        />
      )}
    </View>
  );
}
