import { Autocomplete } from "@base-ui/react/autocomplete";
import { Check } from "lucide-react";
import { type ReactNode, useEffect, useEffectEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { isEditableTarget } from "@/lib/shortcuts/registry";
import type { OptionMenuItem } from "./option-menu-item";

type OptionMenuProps = {
  label: string;
  placeholder: string;
  options: OptionMenuItem[];
  onSelect: (value: string) => void;
  onQueryChange?: (query: string) => void;
  status?: ReactNode;
  inputHint?: ReactNode;
};

export function OptionMenu({
  label,
  placeholder,
  options,
  onSelect,
  onQueryChange,
  status,
  inputHint,
}: OptionMenuProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const filtered = options.filter(
    (option) => option.pinned || option.label.toLowerCase().includes(needle),
  );

  const selectByNumber = (key: string) => {
    if (query || !/^[1-9]$/.test(key)) return false;
    const option = filtered[Number(key) - 1];
    if (!option) return false;
    onSelect(option.value);
    return true;
  };

  const handleEarlyKey = useEffectEvent((event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return;
    if (selectByNumber(event.key)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  useEffect(() => {
    document.addEventListener("keydown", handleEarlyKey, true);
    return () => document.removeEventListener("keydown", handleEarlyKey, true);
  }, []);

  return (
    <Autocomplete.Root
      items={options}
      filteredItems={filtered}
      value={query}
      onValueChange={(value, details) => {
        if (
          details.reason === "input-change" ||
          details.reason === "input-clear"
        ) {
          setQuery(value);
          onQueryChange?.(value);
        }
      }}
      inline
      open
      autoHighlight="always"
      keepHighlight
    >
      <div className="flex h-10 items-center border-border/80 border-b">
        <Autocomplete.Input
          autoFocus
          aria-label={label}
          placeholder={placeholder}
          onKeyDown={(event) => {
            if (selectByNumber(event.key)) event.preventDefault();
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        {inputHint && (
          <span className="shrink-0 pe-3 text-muted-foreground text-xs">
            {inputHint}
          </span>
        )}
      </div>
      {status ? (
        <div className="px-3 py-5 text-muted-foreground text-xs">{status}</div>
      ) : (
        <>
          <Autocomplete.Empty className="px-3 text-muted-foreground text-xs not-empty:py-5">
            {t("tasks:filterMenu.noResults")}
          </Autocomplete.Empty>
          <Autocomplete.List className="max-h-72 overflow-y-auto p-1 empty:hidden">
            {(option: OptionMenuItem) => {
              const index = filtered.indexOf(option);
              return (
                <Autocomplete.Item
                  key={option.value}
                  value={option}
                  aria-current={option.selected || undefined}
                  onClick={() => onSelect(option.value)}
                  className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-[13px] text-foreground outline-none data-highlighted:bg-accent [&_svg]:size-3.5"
                >
                  {option.icon && (
                    <span className="inline-flex size-4 shrink-0 items-center justify-center">
                      {option.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {option.label}
                  </span>
                  {option.hint && (
                    <span className="shrink-0 text-muted-foreground text-xs">
                      {option.hint}
                    </span>
                  )}
                  {option.selected ? (
                    <Check
                      aria-hidden="true"
                      className="shrink-0 text-muted-foreground"
                    />
                  ) : (
                    !query &&
                    index < 9 && (
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-muted-foreground text-xs tabular-nums"
                      >
                        {index + 1}
                      </span>
                    )
                  )}
                </Autocomplete.Item>
              );
            }}
          </Autocomplete.List>
        </>
      )}
    </Autocomplete.Root>
  );
}
