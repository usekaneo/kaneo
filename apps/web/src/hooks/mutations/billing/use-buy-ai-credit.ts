import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { buyAiCredit } from "@/fetchers/billing/ai-credit";

export function useBuyAiCredit(workspaceId: string) {
  const pending = useRef<{ cents: number; requestId: string } | null>(null);
  return useMutation({
    mutationFn: (cents: number) => {
      if (pending.current?.cents !== cents)
        pending.current = { cents, requestId: crypto.randomUUID() };
      return buyAiCredit(workspaceId, cents, pending.current.requestId);
    },
    onSuccess: ({ checkoutUrl }) => {
      window.location.assign(checkoutUrl);
    },
  });
}
