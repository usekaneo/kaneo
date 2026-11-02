import type { ContactOption } from "@/fetchers/contact-options";
import type { ContactOptionItem } from "./contact-option-select";

// Select items for a list of options, led by the "none" choice (value "").
export function contactOptionItems(
  options: readonly Pick<ContactOption, "key" | "label">[],
  noneLabel: string,
): ContactOptionItem[] {
  return [
    { value: "", label: noneLabel },
    ...options.map((option) => ({ value: option.key, label: option.label })),
  ];
}
