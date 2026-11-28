let entered = false;

export function hasAuthEntered() {
  return entered;
}

export function markAuthEntered() {
  entered = true;
}

export function replayAuthEntrance() {
  entered = false;
}
