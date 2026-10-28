import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import columnIcons from "@/constants/column-icons";
import { cn } from "@/lib/cn";

type ColumnIconPickerProps = {
  selected: string | undefined;
  label: string;
  disabled?: boolean;
  onSelect: (iconName: string) => void;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

const ICON_ENTRIES = Object.entries(columnIcons);

export function ColumnIconPicker({
  selected,
  label,
  disabled = false,
  onSelect,
  onOpenChange,
  children,
}: ColumnIconPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const icons = query
    ? ICON_ENTRIES.filter(([name]) => name.toLowerCase().includes(query))
    : ICON_ENTRIES;

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
    onOpenChange?.(next);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          title={label}
          disabled={disabled}
          className="shrink-0 disabled:opacity-100"
        >
          {children}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-2 p-1">
          <Input
            size="sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("settings:columnEditor.searchIconsPlaceholder")}
            aria-label={t("settings:columnEditor.searchIconsPlaceholder")}
          />
          <div className="grid max-h-70 grid-cols-6 gap-1 overflow-y-auto pr-1">
            {icons.map(([name, Icon]) => (
              <Button
                key={name}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={name}
                aria-pressed={selected === name}
                title={name}
                onClick={() => {
                  onSelect(name);
                  changeOpen(false);
                }}
                className={cn(
                  "h-10 w-full",
                  selected === name && "bg-accent text-accent-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
