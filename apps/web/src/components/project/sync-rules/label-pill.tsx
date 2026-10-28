type LabelPillProps = {
  name: string;
  color?: string | null;
};

export function LabelPill({ name, color }: LabelPillProps) {
  return (
    <span className="inline-flex h-5 max-w-full items-center gap-1.5 rounded-md border border-input px-1.5 text-xs">
      {color ? (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      <span className="truncate">{name}</span>
    </span>
  );
}
