export function toolbarPresenceClass(hidden: boolean) {
  return hidden
    ? "pointer-events-none invisible translate-y-3 opacity-0 duration-150 motion-reduce:translate-y-0"
    : "duration-200 starting:translate-y-3 starting:opacity-0 motion-reduce:starting:translate-y-0";
}
