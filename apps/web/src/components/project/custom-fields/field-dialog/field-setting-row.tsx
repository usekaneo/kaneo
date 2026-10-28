import { type ReactNode, useId } from "react";

type FieldSettingRowProps = {
  title: ReactNode;
  description: ReactNode;
  children: (ids: { labelId: string; descriptionId: string }) => ReactNode;
};

export function FieldSettingRow({
  title,
  description,
  children,
}: FieldSettingRowProps) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <div className="flex flex-col gap-2.5 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p id={labelId} className="text-sm">
          {title}
        </p>
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      </div>
      {children({ labelId, descriptionId })}
    </div>
  );
}
