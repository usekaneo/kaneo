import { type ReactElement, type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
  taskPropertyTriggerBaseClassName,
  taskPropertyTriggerClassNames,
} from "./task-property-trigger.styles";

type TaskPropertyTriggerProps = {
  children: ReactNode;
  label: string;
  className?: string;
  canEdit: boolean;
  variant?: "pill" | "avatar";
  renderEditor: (trigger: ReactElement) => ReactNode;
};

export default function TaskPropertyTrigger({
  children,
  label,
  className,
  canEdit,
  variant = "pill",
  renderEditor,
}: TaskPropertyTriggerProps) {
  const [hasOpened, setHasOpened] = useState(false);
  useEffect(() => {
    if (!canEdit) setHasOpened(false);
  }, [canEdit]);
  if (!canEdit) return <>{children}</>;

  const trigger = (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        taskPropertyTriggerBaseClassName,
        taskPropertyTriggerClassNames[variant],
        className,
      )}
      onClick={hasOpened ? undefined : () => setHasOpened(true)}
    >
      {children}
    </button>
  );

  return (
    // Portal events also bubble through this boundary, not through the card.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- event boundary; the child button handles keyboard activation
    <div
      className="contents"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {hasOpened ? renderEditor(trigger) : trigger}
    </div>
  );
}
