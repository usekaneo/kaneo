"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { installCommand } from "@/lib/plugins";
import { cn } from "@/lib/utils";

export function InstallCommand({
  packageName,
  className,
}: {
  packageName: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const command = installCommand(packageName);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border/70 bg-muted py-1 pr-1 pl-3",
        className,
      )}
    >
      <code className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap font-mono text-[0.8125rem]">
        {command}
      </code>
      <Button
        aria-label={`Copy ${command}`}
        onClick={copy}
        size="icon-sm"
        variant="ghost"
      >
        {copied ? (
          <Check aria-hidden="true" className="size-3.5" />
        ) : (
          <Copy aria-hidden="true" className="size-3.5" />
        )}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}
