import type { ReactNode } from "react";

type SectionSeparatorProps = {
  children: ReactNode;
};

export default function SectionSeparator({ children }: SectionSeparatorProps) {
  return (
    <div className="relative w-auto bg-card">
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/30 to-transparent"
      />

      <div
        aria-hidden="true"
        className="absolute top-0 left-0 h-3 w-full bg-[repeating-linear-gradient(-45deg,var(--color-foreground),var(--color-foreground)_1px,transparent_1px,transparent_4px)] opacity-[0.02]"
      />

      {children}
    </div>
  );
}
