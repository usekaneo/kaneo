import type { SyntheticEvent } from "react";

const stop = (event: SyntheticEvent) => event.stopPropagation();

export const stopCardEvents = {
  onClick: stop,
  onPointerDown: stop,
  onTouchStart: stop,
};
