import { cn } from "@/lib/cn";
import { Check, ChevronDown } from "lucide-react";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface SelectOption {
  value: string;
  label: string;
  avatar?: string;
  icon?: React.ReactNode;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400",
          "bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50",
          "text-zinc-900 dark:text-zinc-100",
          className,
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedOption ? (
            <>
              {selectedOption.icon}
              <span className="truncate">{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">
              {placeholder ||
                t("select.placeholder", { defaultValue: "Select option" })}
            </span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 py-1 rounded-md shadow-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm",
                "hover:bg-zinc-100 dark:hover:bg-zinc-700/50",
                value === option.value &&
                  "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
              )}
            >
              {option.avatar && (
                <img
                  src={option.avatar}
                  alt={option.label}
                  className="w-5 h-5 rounded-full object-cover"
                />
              )}
              {option.icon}
              <span className="flex-1 text-left truncate">{option.label}</span>
              {value === option.value && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
