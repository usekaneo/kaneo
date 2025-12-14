import { cn } from "@/lib/cn";

type KbdProps = {
  children: React.ReactNode;
  className?: string;
  description?: string;
  hideDescription?: boolean;
};

export function Kbd({
  children,
  className,
  description,
  hideDescription = false,
}: KbdProps) {
  return (
    <span className="flex items-center gap-1">
      {description && !hideDescription && (
        <span className="text-[10px] text-white">{description}</span>
      )}
      <kbd
        className={cn(
          "pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground opacity-100",
          className,
        )}
      >
        {children}
      </kbd>
    </span>
  );
}

type KbdSequenceProps = {
  keys: string[];
  separator?: string;
  className?: string;
  description?: string;
};

export function KbdSequence({
  keys,
  separator = "then",
  className,
  description,
}: KbdSequenceProps) {
  const keyElements = keys.map((key, index) => ({
    key: key,
    position: index,
    id: `${key}-pos${index}-${Math.random().toString(36).substr(2, 9)}`,
  }));

  return (
    <span className={cn("flex items-center gap-1", className)}>
      {description && (
        <span className="text-[10px] text-popover-foreground">
          {description}
        </span>
      )}
      <span className="flex items-center gap-0.5">
        {keyElements.map((item) => (
          <span key={item.id} className="flex items-center gap-0.5">
            {item.position > 0 && (
              <span className="text-[9px] text-muted-foreground/60">
                {separator}
              </span>
            )}
            <Kbd hideDescription>{item.key}</Kbd>
          </span>
        ))}
      </span>
    </span>
  );
}
