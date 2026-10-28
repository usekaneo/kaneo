export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "dropdown"
  | "multiselect";

export type FieldForm = {
  name: string;
  type: CustomFieldType;
  optionsText: string;
  required: boolean;
  defaultValue: string;
};

export type CreateFieldBody = {
  name: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[];
  defaultValue?: string;
};

export function fieldOptions(text: string): string[] {
  return [
    ...new Set(
      text
        .split(",")
        .map((option) => option.trim())
        .filter(Boolean),
    ),
  ];
}

export function selectedDefaults(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

export function validFieldDefault(
  type: CustomFieldType,
  value: string,
  options: string[],
): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  switch (type) {
    case "number":
      return (
        /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(trimmed) &&
        Number.isFinite(Number(trimmed))
      );
    case "boolean":
      return trimmed === "true" || trimmed === "false";
    case "dropdown":
      return options.includes(trimmed);
    case "multiselect": {
      const values = selectedDefaults(trimmed);
      return (
        values.length > 0 && values.every((option) => options.includes(option))
      );
    }
    case "date": {
      const match =
        /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/.exec(
          trimmed,
        );
      if (!match || Number.isNaN(Date.parse(trimmed))) return false;
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(0);
      date.setUTCFullYear(year, month - 1, day);
      date.setUTCHours(0, 0, 0, 0);
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    }
    case "text":
      return true;
  }
}

export function canSaveField(form: FieldForm): boolean {
  const options = fieldOptions(form.optionsText);
  if (!form.name.trim()) return false;
  if (form.type === "dropdown" && options.length < 1) return false;
  if (form.type === "multiselect" && options.length < 2) return false;
  return (
    !form.required || validFieldDefault(form.type, form.defaultValue, options)
  );
}

export function toCreateFieldBody(form: FieldForm): CreateFieldBody {
  return {
    name: form.name.trim(),
    type: form.type,
    required: form.required,
    options:
      form.type === "dropdown" || form.type === "multiselect"
        ? fieldOptions(form.optionsText)
        : undefined,
    defaultValue: form.required
      ? form.type === "text"
        ? form.defaultValue
        : form.defaultValue.trim()
      : undefined,
  };
}
