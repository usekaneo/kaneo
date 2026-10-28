import type { ShortcutId } from "@/lib/shortcuts/catalog";
import { ShortcutKeys } from "./shortcut-keys";

type ShortcutRowProps = {
  id: ShortcutId;
  label: string;
  query: string;
  isHighlighted: ((cap: string) => boolean) | null;
};

function HighlightedLabel({ label, query }: { label: string; query: string }) {
  const value = query.trim();
  const index = value ? label.toLowerCase().indexOf(value.toLowerCase()) : -1;
  if (index < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, index)}
      <mark className="bg-transparent font-semibold text-foreground">
        {label.slice(index, index + value.length)}
      </mark>
      {label.slice(index + value.length)}
    </>
  );
}

export function ShortcutRow({
  id,
  label,
  query,
  isHighlighted,
}: ShortcutRowProps) {
  return (
    <li className="flex h-8 items-center justify-between gap-4 text-[13px] text-foreground/85">
      <span className="min-w-0 truncate">
        <HighlightedLabel label={label} query={query} />
      </span>
      <ShortcutKeys
        id={id}
        size="md"
        isHighlighted={isHighlighted ?? undefined}
      />
    </li>
  );
}
