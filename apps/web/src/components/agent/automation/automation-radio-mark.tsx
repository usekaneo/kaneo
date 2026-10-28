// The radio circle for card-style options; pairs with a parent `group`
// carrying Base UI's data-checked attribute.
export function AutomationRadioMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-background group-data-checked:border-primary group-data-checked:bg-primary"
    >
      <span className="size-1.5 rounded-full bg-primary-foreground opacity-0 group-data-checked:opacity-100" />
    </span>
  );
}
