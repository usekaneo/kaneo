import { createElement } from "react";
import type { CustomFieldType } from "@/components/project/custom-fields/types";
import { customFieldIcon } from "./custom-field-icon";

type CustomFieldTypeIconProps = {
  type: CustomFieldType;
  className?: string;
};

export function CustomFieldTypeIcon({
  type,
  className,
}: CustomFieldTypeIconProps) {
  return createElement(customFieldIcon(type), {
    className,
    "aria-hidden": true,
  });
}
