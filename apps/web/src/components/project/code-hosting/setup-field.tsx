import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

type SetupFieldProps = {
  label: ReactNode;
  htmlFor: string;
  error?: string | null;
  className?: string;
  children: ReactNode;
};

export function SetupField({
  label,
  htmlFor,
  error,
  className,
  children,
}: SetupFieldProps) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[13px] font-medium">
        {label}
      </Label>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="text-xs text-destructive-foreground"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
