import { Ban, Link2, OctagonAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

export type RelationKind = "blocked_by" | "blocks" | "related";

const tones = {
  blocked_by: {
    className: "bg-destructive/8 text-destructive-foreground",
    icon: Ban,
    labelKey: "tasks:relations.blockedBy",
  },
  blocks: {
    className: "bg-warning/10 text-warning-foreground",
    icon: OctagonAlert,
    labelKey: "tasks:relations.blocks",
  },
  related: {
    className: "bg-accent text-muted-foreground",
    icon: Link2,
    labelKey: "tasks:relations.related",
  },
} as const;

export function RelationTag({ kind }: { kind: RelationKind }) {
  const { t } = useTranslation();
  const tone = tones[kind];
  const Icon = tone.icon;

  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.25 rounded-[5px] px-1.75 font-medium text-[11px]",
        tone.className,
      )}
    >
      <Icon aria-hidden="true" className="size-2.75" />
      {t(tone.labelKey)}
    </span>
  );
}
