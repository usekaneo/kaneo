import { Autocomplete } from "@base-ui/react/autocomplete";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { barButtonClass } from "./bar-button-class";
import { BarTooltip } from "./bar-tooltip";

export type BulkOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

type BulkOptionPopoverProps = {
  icon: ReactNode;
  label: string;
  placeholder: string;
  options: BulkOption[];
  onSelect: (value: string) => void;
  className?: string;
};

export function BulkOptionPopover({
  icon,
  label,
  placeholder,
  options,
  onSelect,
  className,
}: BulkOptionPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(needle),
  );

  const select = (value: string) => {
    setOpen(false);
    onSelect(value);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <BarTooltip label={label}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={
                className ? `${barButtonClass} ${className}` : barButtonClass
              }
            />
          }
        >
          {icon}
          <span className="max-lg:sr-only">{label}</span>
        </PopoverTrigger>
      </BarTooltip>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-60 p-0"
      >
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
          <Autocomplete.Input
            autoFocus
            aria-label={label}
            placeholder={placeholder}
            onKeyDown={(event) => {
              if (query || !/^[1-9]$/.test(event.key)) return;
              const option = filtered[Number(event.key) - 1];
              if (!option) return;
              event.preventDefault();
              select(option.value);
            }}
            className="h-10 w-full border-border/80 border-b bg-transparent px-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <Autocomplete.Empty className="px-3 text-muted-foreground text-xs not-empty:py-5">
            {t("tasks:filterMenu.noResults")}
          </Autocomplete.Empty>
          <Autocomplete.List className="max-h-72 overflow-y-auto p-1 empty:hidden">
            {(option: BulkOption) => {
              const index = filtered.indexOf(option);
              return (
                <Autocomplete.Item
                  key={option.value}
                  value={option}
                  onClick={() => select(option.value)}
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
                  {!query && index < 9 && (
                    <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                      {index + 1}
                    </span>
                  )}
                </Autocomplete.Item>
              );
            }}
          </Autocomplete.List>
        </Autocomplete.Root>
      </PopoverContent>
    </Popover>
  );
}
