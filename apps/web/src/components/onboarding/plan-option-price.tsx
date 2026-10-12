type PlanOptionPriceProps = { price: string; unit: string };

export function PlanOptionPrice({ price, unit }: PlanOptionPriceProps) {
  return (
    <span className="flex shrink-0 flex-col items-end gap-0.5">
      <span className="font-medium text-foreground text-sm">{price}</span>
      <span className="text-muted-foreground text-xs">{unit}</span>
    </span>
  );
}
