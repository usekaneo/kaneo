import { getDatabasePool } from ".";

let held = 0;

/** Holders pin a pooled client, so one always stays free for their queries. */
export function reserveSessionLock(): boolean {
  if (held >= getDatabasePool().options.max - 1) return false;
  held++;
  return true;
}

export function releaseSessionLock() {
  held--;
}
