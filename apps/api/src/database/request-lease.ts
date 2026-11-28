import type db from ".";

export type LeaseTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export interface RequestLease {
  /** Verify and renew ownership before starting another external operation. */
  check(): Promise<void>;
  /** Keep ownership verification and a bounded database write atomic. */
  transaction<T>(run: (tx: LeaseTransaction) => Promise<T>): Promise<T>;
}

export const REQUEST_LEASE_MS = 2 * 60_000;
export const REQUEST_LEASE_RENEWAL_MS = 30_000;
