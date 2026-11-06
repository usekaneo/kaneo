let entered = false;

export function hasShellEntered() {
  return entered;
}

export function markShellEntered() {
  entered = true;
}

export function replayShellEntrance() {
  entered = false;
}
