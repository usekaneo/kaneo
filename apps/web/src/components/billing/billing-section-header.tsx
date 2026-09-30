type BillingSectionHeaderProps = {
  title: string;
  subtitle: string;
};

export function BillingSectionHeader({
  title,
  subtitle,
}: BillingSectionHeaderProps) {
  return (
    <div className="space-y-1">
      <h2 className="font-medium text-md">{title}</h2>
      <p className="text-muted-foreground text-xs">{subtitle}</p>
    </div>
  );
}
