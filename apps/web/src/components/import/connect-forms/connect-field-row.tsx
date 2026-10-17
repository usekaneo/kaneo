import type { ReactNode } from "react";
import {
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/import/connect-forms/field-ids";

type ConnectFieldRowProps = {
  id: string;
  label: string;
  description: ReactNode;
  labelFor?: string;
  error?: string | null;
  children: ReactNode;
};

export function ConnectFieldRow({
  id,
  label,
  description,
  labelFor,
  error,
  children,
}: ConnectFieldRowProps) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-0.5">
        {labelFor ? (
          <label
            htmlFor={labelFor}
            id={`${id}-label`}
            className="font-medium text-sm"
          >
            {label}
          </label>
        ) : (
          <p id={`${id}-label`} className="font-medium text-sm">
            {label}
          </p>
        )}
        <div
          id={fieldDescriptionId(id)}
          className="text-muted-foreground text-xs"
        >
          {description}
        </div>
      </div>
      <div className="w-full shrink-0 space-y-1.5 sm:w-72">
        {children}
        {error ? (
          <p
            id={fieldErrorId(id)}
            className="text-destructive-foreground text-xs"
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
