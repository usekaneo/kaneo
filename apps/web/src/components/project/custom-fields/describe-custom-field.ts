import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type DescribedField = Pick<
  CustomFieldDefinition,
  "type" | "defaultValue" | "options"
>;

const MAX_LISTED_OPTIONS = 3;
const SEPARATOR = " · ";

export function describeOptions(options: string[] | null, t: Translate) {
  const list = options ?? [];
  const shown = list.slice(0, MAX_LISTED_OPTIONS).join(", ");
  const hiddenCount = list.length - MAX_LISTED_OPTIONS;

  return hiddenCount > 0
    ? `${shown} ${t("settings:customFields.moreOptions", { hiddenCount })}`
    : shown;
}

export function formatDateDefault(value: string, locale?: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return match[0];
  }
}

function describeDefault(field: DescribedField, t: Translate, locale?: string) {
  const value = field.defaultValue?.trim() ?? "";

  switch (field.type) {
    case "dropdown":
    case "multiselect":
      return describeOptions(field.options, t);
    case "boolean":
      return value === "true"
        ? t("settings:customFields.startsChecked")
        : t("settings:customFields.startsUnchecked");
    case "text":
      return value ? t("settings:customFields.startsAs", { value }) : "";
    case "number":
      return value ? t("settings:customFields.startsAt", { value }) : "";
    case "date":
      return value
        ? t("settings:customFields.startsOn", {
            date: formatDateDefault(value, locale),
          })
        : "";
  }
}

export function describeCustomField(
  field: DescribedField,
  t: Translate,
  locale?: string,
) {
  const typeLabel = t(`settings:customFields.types.${field.type}`);
  const detail = describeDefault(field, t, locale);

  return detail ? `${typeLabel}${SEPARATOR}${detail}` : typeLabel;
}
