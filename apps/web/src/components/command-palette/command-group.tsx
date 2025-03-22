import { cn } from "@/lib/cn";
import { Command } from "cmdk";
import type { ReactNode } from "react";

interface CommandGroupProps {
  heading: string;
  children: ReactNode;
  className?: string;
}

function CommandGroup({ heading, children, className }: CommandGroupProps) {
  return (
    <Command.Group heading={heading} className={cn("relative", className)}>
      <div className="absolute -left-4 -ml-0.5 h-full w-px bg-zinc-200 dark:bg-zinc-700" />
      {children}
    </Command.Group>
  );
}

export default CommandGroup;
