import { cn } from "@/lib/utils";
import { useMemo, useRef, useState } from "react";

export const inputClasses = cn(
  "bg-ob-btn-secondary-bg text-ob-base-300 border-ob-border focus:border-ob-border-active placeholder:text-ob-base-100 add-disable border border-1 transition-colors focus:outline-none"
);

export type InputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> & {
  children?: React.ReactNode;
  className?: string;
  displayContent?: "items-first" | "items-last"; // used for children of component
  initialValue?: string;
  isValid?: boolean;
  onValueChange: ((value: string, isValid: boolean) => void) | undefined;
  preText?: string[] | React.ReactNode[] | React.ReactNode;
  postText?: string[] | React.ReactNode[] | React.ReactNode;
  size?: "sm" | "md" | "base";
};

export const Input = ({
  children,
  className,
  displayContent,
  initialValue,
  isValid = true,
  onValueChange,
  preText,
  postText,
  size = "base",
  ...props
}: InputProps) => {
  const [currentValue, setCurrentValue] = useState(initialValue ?? "");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useMemo(() => {
    setCurrentValue(initialValue ?? "");
  }, [initialValue]);

  const updateCurrentValue = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setCurrentValue(newValue);

    if (onValueChange) {
      if (!props.min) {
        onValueChange(newValue, isValid);
      } else if (typeof props.min === "number") {
        onValueChange(newValue.slice(0, props.min), isValid);
      }
    }
  };

  const handlePreTextInputClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return preText ? (
    // biome-ignore lint/a11y/useKeyWithClickEvents: todo
    // biome-ignore lint/a11y/noStaticElementInteractions: todo
    <div
      className={cn(
        "has-[:disabled]:ob-disable has-[:enabled]:active:border-ob-border-active has-[:focus]:border-ob-border-active flex cursor-text",
        inputClasses,
        {
          "add-size-sm": size === "sm",
          "add-size-md": size === "md",
          "add-size-base": size === "base"
        },
        className
      )}
      onClick={handlePreTextInputClick}
    >
      <span className="text-ob-base-200 pointer-events-none mr-0.5 flex items-center gap-2 transition-colors select-none">
        {preText}
      </span>

      <input
        className={cn(
          "placeholder:text-ob-base-100 w-full bg-transparent focus:outline-none",
          {
            "text-ob-destructive": !isValid
          }
        )}
        onChange={updateCurrentValue}
        ref={inputRef}
        value={currentValue}
        {...props}
      />

      <span className="text-ob-base-200 mr-0.5 flex items-center gap-2 transition-colors select-none">
        {postText}
      </span>
    </div>
  ) : (
    <input
      className={cn(
        inputClasses,
        {
          "text-ob-destructive transition-colors": !isValid,
          "add-size-sm": size === "sm",
          "add-size-md": size === "md",
          "add-size-base": size === "base"
        },
        className
      )}
      onChange={updateCurrentValue}
      value={currentValue}
      {...props}
    />
  );
};
