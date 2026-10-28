import {
  CalendarIcon,
  Hash,
  List,
  type LucideIcon,
  SquareCheck,
  Type,
} from "lucide-react";
import type {
  CustomFieldType,
  FieldKind,
} from "@/components/project/custom-fields/types";

export const FIELD_KIND_ICONS: Record<FieldKind, LucideIcon> = {
  text: Type,
  number: Hash,
  date: CalendarIcon,
  dropdown: List,
  boolean: SquareCheck,
};

export const FIELD_KINDS = (Object.keys(FIELD_KIND_ICONS) as FieldKind[]).map(
  (kind) => ({ kind, icon: FIELD_KIND_ICONS[kind] }),
);

export function toFieldKind(type: CustomFieldType): FieldKind {
  return type === "multiselect" ? "dropdown" : type;
}
