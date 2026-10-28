import type { FocusEvent } from "react";

export function isKeyboardFocus(event: FocusEvent<Element>) {
  return (
    event.target instanceof Element && event.target.matches(":focus-visible")
  );
}
