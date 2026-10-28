import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SelectButton } from "@/components/ui/select";
import icons from "@/constants/project-icons";
import { cn } from "@/lib/cn";

type ProjectIconPickerProps = {
  value: string;
  onChange: (icon: string) => void;
  disabled?: boolean;
};

export function ProjectIconPicker({
  value,
  onChange,
  disabled,
}: ProjectIconPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedName = value || "Layout";
  const SelectedIcon =
    icons[selectedName as keyof typeof icons] ?? icons.Layout;
  const query = search.trim().toLowerCase();
  const matches = Object.entries(icons).filter(([name]) =>
    name.toLowerCase().includes(query),
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal>
      <PopoverTrigger
        render={
          <SelectButton
            size="sm"
            className="sm:w-64"
            disabled={disabled}
            title={t("settings:projectGeneral.pickIconTitle")}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <SelectedIcon aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{selectedName}</span>
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <Input
            size="sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("settings:projectGeneral.searchIconsPlaceholder")}
            aria-label={t("settings:projectGeneral.searchIconsPlaceholder")}
          />
          <div className="max-h-[280px] overflow-y-auto pr-1">
            <div className="grid grid-cols-6 gap-1.5">
              {matches.map(([name, Icon]) => (
                <Button
                  key={name}
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={name}
                  aria-pressed={name === selectedName}
                  title={name}
                  onClick={() => {
                    onChange(name);
                    handleOpenChange(false);
                  }}
                  className={cn(
                    "h-10 items-center justify-center rounded-md p-0",
                    name === selectedName &&
                      "bg-sidebar-accent text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
