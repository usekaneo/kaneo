import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Txt } from "@/components/text";
import { Button, Chip, Switch, TextField } from "@/components/ui";

import { CustomFieldDefaultInput } from "./custom-field-default-input";
import {
  canSaveField,
  fieldOptions,
  toCreateFieldBody,
  validFieldDefault,
  type CreateFieldBody,
  type FieldForm,
} from "./field-form";
import { useFieldTypes } from "./use-field-types";

export function CustomFieldForm({
  onClose,
  onAdd,
  busy,
}: {
  onClose: () => void;
  onAdd: (body: CreateFieldBody) => Promise<unknown | undefined>;
  busy: boolean;
}) {
  const { t } = useTranslation(["mobile"]);
  const fieldTypes = useFieldTypes();
  const [form, setForm] = useState<FieldForm>({
    name: "",
    type: "text",
    optionsText: "",
    required: false,
    defaultValue: "",
  });
  const { name, type, optionsText, required, defaultValue } = form;
  const needsOptions = type === "dropdown" || type === "multiselect";
  const options = fieldOptions(optionsText);
  const valid = canSaveField(form);
  const submit = async () => {
    if (!valid || busy) return;
    const result = await onAdd(toCreateFieldBody(form));
    if (result !== undefined) onClose();
  };

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 16 }}>
      <TextField
        label={t("mobile:projectSettings.name")}
        value={name}
        onChangeText={(name) => setForm((current) => ({ ...current, name }))}
        placeholder={t("mobile:projectSettings.platform")}
        autoFocus
      />
      <View style={{ gap: 8 }}>
        <Txt variant="meta" weight="medium" tone="body">
          {t("mobile:projectSettings.type")}
        </Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {fieldTypes.map((fieldType) => (
            <Chip
              key={fieldType.value}
              label={fieldType.label}
              selected={type === fieldType.value}
              onPress={() =>
                setForm((current) =>
                  current.type === fieldType.value
                    ? current
                    : {
                        ...current,
                        type: fieldType.value,
                        defaultValue:
                          fieldType.value === "boolean" ? "false" : "",
                      },
                )
              }
            />
          ))}
        </View>
      </View>
      {needsOptions ? (
        <TextField
          label={t("mobile:projectSettings.options")}
          aside={t("mobile:projectSettings.separateWithCommas")}
          value={optionsText}
          onChangeText={(optionsText) =>
            setForm((current) => ({ ...current, optionsText }))
          }
          placeholder={t("mobile:projectSettings.androidIOSWeb")}
          hint={
            type === "multiselect" && options.length < 2
              ? t("mobile:projectSettings.multiselectOptionsRequired")
              : undefined
          }
        />
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Txt variant="bodySm">{t("mobile:projectSettings.required")}</Txt>
        <Switch
          value={required}
          onChange={(required) =>
            setForm((current) => ({ ...current, required }))
          }
        />
      </View>
      {required ? (
        <>
          <CustomFieldDefaultInput
            key={type}
            type={type}
            value={defaultValue}
            options={options}
            onChange={(defaultValue) =>
              setForm((current) => ({ ...current, defaultValue }))
            }
          />
          {!validFieldDefault(type, defaultValue, options) ? (
            <Txt variant="caption" tone="faint">
              {t("mobile:projectSettings.validDefaultRequired")}
            </Txt>
          ) : null}
        </>
      ) : null}
      <Button
        label={t("mobile:projectSettings.addField")}
        disabled={!valid}
        loading={busy}
        onPress={() => void submit()}
      />
    </View>
  );
}
