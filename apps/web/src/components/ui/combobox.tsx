import { CheckIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/cn";

export type ComboboxOption = {
  value: string;
  label: string;
  icon?: React.ReactNode;
};

export type ComboboxProps = {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "xs";
};

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No option found.",
  className,
  disabled = false,
  variant = "outline",
  size = "default",
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOption = options.find((option) => option.value === value);

  // Adjust width and text size based on size prop
  const sizeConfig = {
    default: { width: "!w-[200px]", textSize: "text-sm" },
    sm: { width: "w-[160px]", textSize: "text-xs" },
    xs: { width: "w-[120px]", textSize: "text-xs" },
  };

  const config = sizeConfig[size];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={size}
          aria-expanded={open}
          className={cn(config.width, "justify-between", className)}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            {selectedOption?.icon && selectedOption.icon}
            <span className={config.textSize}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(config.width, "p-0")}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup className="w-[200px]">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  className="flex items-center w-full"
                  onSelect={(currentValue) => {
                    const newValue = currentValue === value ? "" : currentValue;
                    onValueChange?.(newValue);
                    setOpen(false);
                  }}
                >
                  {option.icon && option.icon}
                  <span className={config.textSize}>{option.label}</span>
                  <CheckIcon
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
