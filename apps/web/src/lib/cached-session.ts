import { authClient } from "./auth-client";

const REVALIDATE_AFTER_MS = 60_000;

type SessionData = NonNullable<
  Awaited<ReturnType<typeof authClient.getSession>>["data"]
>;

type SessionAtom = {
  data: SessionData | null;
  isPending: boolean;
  refetch: () => Promise<unknown>;
};

let lastRevalidatedAt = Date.now();

export function getCachedSession(): SessionData | null {
  const current = authClient.$store.atoms.session?.get() as
    | SessionAtom
    | undefined;
  if (!current?.data || current.isPending) return null;
  if (Date.now() - lastRevalidatedAt > REVALIDATE_AFTER_MS) {
    lastRevalidatedAt = Date.now();
    void current.refetch();
  }
  return current.data;
}
