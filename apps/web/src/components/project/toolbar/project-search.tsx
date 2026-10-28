import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SearchField } from "./search-field";
import { useFindShortcut } from "./use-find-shortcut";

type ProjectSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function ProjectSearch({ value, onChange }: ProjectSearchProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const expanded = open || value !== "";
  const label = t("tasks:toolbar.search");

  useFindShortcut(() => {
    setOpen(true);
    inputRef.current?.focus();
    inputRef.current?.select();
  });

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (expanded) {
    return (
      <SearchField
        ref={inputRef}
        value={value}
        onChange={onChange}
        onBlur={() => setOpen(false)}
        className="flex w-44 sm:w-56"
      />
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={() => setOpen(true)}
          />
        }
      >
        <Search />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
