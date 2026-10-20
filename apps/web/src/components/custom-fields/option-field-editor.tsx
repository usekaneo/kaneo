import { Autocomplete } from "@base-ui/react/autocomplete";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { cn } from "@/lib/cn";
import { CheckboxMark } from "./checkbox-mark";

type OptionFieldEditorProps = {
  field: CustomFieldDefinition;
  selected: string[];
  onToggle: (option: string) => void;
  onClear: () => void;
};

export function OptionFieldEditor({
  field,
  selected,
  onToggle,
  onClear,
}: OptionFieldEditorProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const multiple = field.type === "multiselect";
  const options = Array.from(new Set(field.options ?? []));
  const needle = query.trim().toLowerCase();
  const filtered = options.filter((option) =>
    option.toLowerCase().includes(needle),
  );

  return (
    <div className="w-60">
      <Autocomplete.Root
        items={options}
        filteredItems={filtered}
        value={query}
        onValueChange={(value, details) => {
          if (
            details.reason === "input-change" ||
            details.reason === "input-clear"
          )
            setQuery(value);
        }}
        inline
        open
        autoHighlight="always"
        keepHighlight
      >
        <div className="flex items-center border-border/80 border-b">
          <Autocomplete.Input
            autoFocus
            aria-label={field.name}
            placeholder={t("tasks:customFields.setValue", {
              field: field.name,
            })}
            className="h-10 min-w-0 flex-1 bg-transparent px-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {field.required && (
            <span className="shrink-0 pe-3 text-muted-foreground text-xs">
              {t("tasks:customFields.required")}
            </span>
          )}
        </div>
        <Autocomplete.Empty className="px-3 text-muted-foreground text-xs not-empty:py-5">
          {t("tasks:customFields.noMatches")}
        </Autocomplete.Empty>
        <Autocomplete.List className="max-h-72 overflow-y-auto p-1 empty:hidden">
          {(option: string) => {
            const isSelected = selected.includes(option);
            return (
              <Autocomplete.Item
                key={option}
                value={option}
                onClick={() => onToggle(option)}
                className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-[13px] text-foreground outline-none data-highlighted:bg-accent"
              >
                {multiple ? (
                  <CheckboxMark checked={isSelected} />
                ) : (
                  <Check
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 shrink-0",
                      !isSelected && "invisible",
                    )}
                  />
                )}
                <span className="min-w-0 flex-1 truncate">{option}</span>
              </Autocomplete.Item>
            );
          }}
        </Autocomplete.List>
      </Autocomplete.Root>
      {!field.required && selected.length > 0 && (
        <div className="border-border/80 border-t p-1">
          <button
            type="button"
            onClick={onClear}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground outline-none hover:bg-accent focus-visible:bg-accent"
          >
            <X aria-hidden="true" className="size-3.5" />
            {t("tasks:customFields.clear")}
          </button>
        </div>
      )}
    </div>
  );
}
