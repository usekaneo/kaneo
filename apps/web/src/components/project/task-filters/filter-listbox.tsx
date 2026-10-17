import { Autocomplete } from "@base-ui/react/autocomplete";
import { type KeyboardEvent, type Ref, useRef, useState } from "react";
import type { FilterEntry, FilterEntryGroup } from "./filter-entries";
import { FilterListboxItem } from "./filter-listbox-item";

type FilterListboxProps = {
  placeholder: string;
  groups: FilterEntryGroup[];
  query: string;
  onQueryChange: (query: string) => void;
  emptyLabel: string;
  activeValue?: string | null;
  inputRef?: Ref<HTMLInputElement>;
  onEntrySelect: (entry: FilterEntry, element: HTMLElement) => void;
  onEntryHover?: (entry: FilterEntry, element: HTMLElement) => void;
  onInputKeyDown?: (
    event: KeyboardEvent<HTMLInputElement>,
    highlighted: { entry: FilterEntry; element: HTMLElement } | null,
  ) => void;
};

export function FilterListbox({
  placeholder,
  groups,
  query,
  onQueryChange,
  emptyLabel,
  activeValue,
  inputRef,
  onEntrySelect,
  onEntryHover,
  onInputKeyDown,
}: FilterListboxProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState<FilterEntry | null>(null);

  const highlightedElement = () =>
    highlighted
      ? listRef.current?.querySelector<HTMLElement>(
          `[data-entry="${CSS.escape(highlighted.value)}"]`,
        )
      : null;

  return (
    <Autocomplete.Root
      items={groups}
      filteredItems={groups}
      value={query}
      onValueChange={(value, details) => {
        if (
          details.reason === "input-change" ||
          details.reason === "input-clear"
        )
          onQueryChange(value);
      }}
      onItemHighlighted={(value) =>
        setHighlighted((value as FilterEntry | undefined) ?? null)
      }
      inline
      open
      autoHighlight="always"
      keepHighlight
    >
      <Autocomplete.Input
        ref={inputRef}
        autoFocus
        placeholder={placeholder}
        onKeyDown={(event) => {
          const element = highlightedElement();
          onInputKeyDown?.(
            event,
            highlighted && element ? { entry: highlighted, element } : null,
          );
        }}
        className="h-10 w-full border-border/80 border-b bg-transparent px-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
      />
      <Autocomplete.Empty className="px-3 text-muted-foreground text-xs not-empty:py-5">
        {emptyLabel}
      </Autocomplete.Empty>
      <Autocomplete.List
        ref={listRef}
        className="max-h-80 overflow-y-auto p-1 empty:hidden"
      >
        {(group: FilterEntryGroup) => (
          <Autocomplete.Group
            key={group.value}
            items={group.items}
            className="not-first:mt-1 not-first:border-border/80 not-first:border-t not-first:pt-1"
          >
            {group.label && (
              <Autocomplete.GroupLabel className="px-2 pt-1 pb-0.5 text-muted-foreground text-xs">
                {group.label}
              </Autocomplete.GroupLabel>
            )}
            <Autocomplete.Collection>
              {(entry: FilterEntry) => (
                <FilterListboxItem
                  key={entry.value}
                  entry={entry}
                  active={entry.value === activeValue}
                  onSelect={onEntrySelect}
                  onHover={onEntryHover}
                />
              )}
            </Autocomplete.Collection>
          </Autocomplete.Group>
        )}
      </Autocomplete.List>
    </Autocomplete.Root>
  );
}
