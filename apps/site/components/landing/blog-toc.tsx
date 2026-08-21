"use client";

import { useEffect, useState } from "react";
import type { TocEntry } from "@/lib/blog/types";
import { cn } from "@/lib/utils";

export function BlogToc({ entries }: { entries: TocEntry[] }) {
  const [activeId, setActiveId] = useState(entries[0]?.id ?? "");

  useEffect(() => {
    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (record.isIntersecting) visible.add(record.target.id);
          else visible.delete(record.target.id);
        }

        // Highlight the highest heading currently in the reading band; when the
        // band is empty (long section, no heading on screen) keep the last one.
        const next = entries.find((entry) => visible.has(entry.id));
        if (next) setActiveId(next.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    for (const entry of entries) {
      const element = document.getElementById(entry.id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, [entries]);

  if (entries.length < 3) return null;

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="font-medium text-foreground/50 text-xs uppercase tracking-wide">
        On this page
      </p>
      <ul className="mt-4 space-y-2 border-border/70 border-l">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              className={cn(
                "-ml-px block border-transparent border-l py-0.5 pl-4 leading-snug transition-colors",
                entry.depth === 3 && "pl-7 text-[0.8125rem]",
                activeId === entry.id
                  ? "border-primary text-foreground"
                  : "text-foreground/55 hover:text-foreground",
              )}
              href={`#${entry.id}`}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
