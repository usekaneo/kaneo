import { type ReactElement, useState } from "react";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { DateFieldEditor } from "./date-field-editor";
import { OptionFieldEditor } from "./option-field-editor";
import { parseMultiselect } from "./parse-multiselect";
import { TextFieldEditor } from "./text-field-editor";

type CustomFieldPopoverProps = {
  field: CustomFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  side?: "bottom" | "left";
  children: ReactElement;
};

export function CustomFieldPopover({
  field,
  value,
  onChange,
  side = "bottom",
  children,
}: CustomFieldPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const isText = field.type === "text" || field.type === "number";

  const commit = (next: string) => {
    if (next === value) return;
    if (field.required && next.trim() === "") return;
    onChange(next);
  };

  const commitDraft = () => commit(draft.trim());

  const close = () => setOpen(false);

  const toggleOption = (option: string) => {
    if (field.type === "dropdown") {
      commit(option);
      close();
      return;
    }
    const selected = parseMultiselect(value);
    const next = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option];
    if (field.required && next.length === 0) return;
    commit(JSON.stringify(next));
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        if (next) setDraft(value);
        else if (isText && details.reason !== "escape-key") commitDraft();
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        className={cn("p-0", field.type === "date" && "w-65")}
      >
        {isText && (
          <TextFieldEditor
            field={field}
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={() => {
              commitDraft();
              close();
            }}
          />
        )}
        {field.type === "date" && (
          <DateFieldEditor
            name={field.name}
            value={value}
            required={field.required}
            onSelect={(next) => {
              commit(next);
              close();
            }}
          />
        )}
        {(field.type === "dropdown" || field.type === "multiselect") && (
          <OptionFieldEditor
            field={field}
            selected={
              field.type === "dropdown"
                ? value
                  ? [value]
                  : []
                : parseMultiselect(value)
            }
            onToggle={toggleOption}
            onClear={() => {
              commit(field.type === "multiselect" ? "[]" : "");
              close();
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
