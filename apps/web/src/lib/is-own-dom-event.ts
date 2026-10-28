import type { SyntheticEvent } from "react";

export function isOwnDomEvent(event: SyntheticEvent<Element>) {
  return (
    event.target instanceof Node && event.currentTarget.contains(event.target)
  );
}
