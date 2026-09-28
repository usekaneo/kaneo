import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageIntro({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("max-w-4xl", className)}>
      {eyebrow ? (
        <div className="mb-5 text-xs font-medium text-muted-foreground">
          {eyebrow}
        </div>
      ) : null}
      <h1 className="text-balance text-4xl font-medium leading-[1.06] md:text-5xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-5 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground md:text-xl">
          {description}
        </p>
      ) : null}
      {children}
    </header>
  );
}
