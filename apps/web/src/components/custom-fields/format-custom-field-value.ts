import { isValid, parseISO } from "date-fns";
import type { CustomFieldType } from "@/components/project/custom-fields/types";
import { formatDateMedium, formatDateShort } from "@/lib/format";
import { parseMultiselect } from "./parse-multiselect";

const VISIBLE_OPTIONS = 2;

export type CustomFieldDisplay = { text: string; more: number };

export function formatCustomFieldValue(
  type: CustomFieldType,
  raw: string,
  dateStyle: "short" | "medium",
): CustomFieldDisplay | null {
  if (type === "boolean") return null;

  if (type === "multiselect") {
    const values = parseMultiselect(raw);
    if (values.length === 0) return null;
    return {
      text: values.slice(0, VISIBLE_OPTIONS).join(", "),
      more: Math.max(0, values.length - VISIBLE_OPTIONS),
    };
  }

  const value = raw.trim();
  if (!value) return null;

  if (type === "date") {
    const date = parseISO(value);
    if (!isValid(date)) return { text: value, more: 0 };
    return {
      text:
        dateStyle === "short" ? formatDateShort(date) : formatDateMedium(date),
      more: 0,
    };
  }

  return { text: value, more: 0 };
}
