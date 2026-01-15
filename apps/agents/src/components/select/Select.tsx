import { cn } from "@/lib/utils";
import { useState } from "react";

export type OptionProps = {
  value: string;
};

export type SelectProps = {
  className?: string;
  options: OptionProps[];
  placeholder?: string;
  setValue: (value: string) => void;
  size?: "sm" | "md" | "base";
  value: string;
};

export const Select = ({
  className,
  options,
  placeholder,
  setValue,
  size = "base",
  value
}: SelectProps) => {
  const [isPointer, setIsPointer] = useState(false); // if user is using a pointer device

  return (
    <select
      onPointerDown={(e: React.PointerEvent<HTMLSelectElement>) => {
        if (e.pointerType === "mouse") {
          setIsPointer(true);
        }
      }}
      onBlur={() => setIsPointer(false)}
      className={cn(
        "btn btn-secondary interactive relative appearance-none truncate bg-no-repeat focus:outline-none",
        {
          "add-size-sm !pr-6.5": size === "sm",
          "add-size-md !pr-8": size === "md",
          "add-size-base !pr-9": size === "base",
          "add-focus": isPointer === false
        },
        className
      )}
      style={{
        backgroundImage: "url(/assets/caret.svg)",
        backgroundPosition: `calc(100% - ${size === "base" ? "10px" : size === "md" ? "8px" : "6px"}) calc(100% / 2)`,
        backgroundSize:
          size === "base" ? "16px" : size === "md" ? "14px" : "12px"
      }}
      onChange={(e) => {
        setValue(e.target.value);
        e.target.blur();
      }}
      value={value}
    >
      {placeholder && <option value={undefined}>{placeholder}</option>}
      {options.map((option, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: TODO
        <option value={option.value} key={index}>
          {option.value}
        </option>
      ))}
    </select>
  );
};
