import { useRef } from "react";
import { authClient } from "@/lib/auth-client";

export function useSettledSession() {
  const { data, isPending } = authClient.useSession();
  const settled = useRef(false);
  if (!isPending) settled.current = true;
  return { session: data, isLoading: isPending && !settled.current };
}
