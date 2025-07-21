import { cn } from "@/lib/cn";

interface KbdProps {
  children: React.ReactNode;
  className?: string;
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

interface KbdSequenceProps {
  keys: string[];
  separator?: string;
  className?: string;
}

export function KbdSequence({
  keys,
  separator = "then",
  className,
}: KbdSequenceProps) {
  const keyElements = keys.map((key, index) => ({
    key: key,
    position: index,
    id: `${key}-pos${index}-${Math.random().toString(36).substr(2, 9)}`,
  }));

  return (
    <span className={cn("flex items-center gap-1", className)}>
      {keyElements.map((item) => (
        <span key={item.id} className="flex items-center gap-1">
          {item.position > 0 && <span className="text-xs">{separator}</span>}
          <Kbd>{item.key}</Kbd>
        </span>
      ))}
    </span>
  );
}
