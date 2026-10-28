import type { ReactNode } from "react";

type RepositoryPickerMessageProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "default" | "destructive";
};

export function RepositoryPickerMessage({
  title,
  description,
  action,
  tone = "default",
}: RepositoryPickerMessageProps) {
  return (
    <div
      role={tone === "destructive" ? "alert" : undefined}
      className="flex flex-col items-center gap-3 px-6 py-10 text-center"
    >
      <div className="space-y-1">
        <p
          className={
            tone === "destructive"
              ? "text-sm font-medium text-destructive-foreground"
              : "text-sm font-medium"
          }
        >
          {title}
        </p>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
