import { useEffect } from "react";
import { trackSignup } from "@/lib/analytics/activation";
import { isNewSignup } from "@/lib/analytics/is-new-signup";

type SessionUser = {
  id: string;
  createdAt: Date | string;
  isAnonymous?: boolean | null;
};

export function useTrackSignup(user: SessionUser | undefined) {
  const id = user?.id;
  const createdAt = user?.createdAt;
  const isAnonymous = user?.isAnonymous;

  useEffect(() => {
    if (!id || !createdAt || !isNewSignup(createdAt)) return;
    trackSignup({ id, isAnonymous });
  }, [id, createdAt, isAnonymous]);
}
