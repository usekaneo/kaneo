import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/toast";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import { qk } from "@/lib/query";

const DELAY_MS = 700;

export type AutosaveStatus = "idle" | "saving" | "saved";

export function useDescriptionAutosave(taskId: string, saved: string) {
  const client = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const lastSaved = useRef(saved);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const flush = useCallback(async (): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inFlight.current) await inFlight.current;
    const text = pending.current;
    pending.current = null;
    if (text === null || text === lastSaved.current) return;
    setStatus("saving");
    const request = api
      .updateDescription(taskId, text)
      .then(() => {
        lastSaved.current = text;
        setStatus("saved");
        void client.invalidateQueries({ queryKey: qk.task(taskId) });
      })
      .catch((e: unknown) => {
        if (pending.current === null) pending.current = text;
        setStatus("idle");
        toast.show(userMessage(e), "error");
      })
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = request;
    await request;
  }, [client, taskId, toast]);

  const change = useCallback(
    (text: string) => {
      pending.current = text;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), DELAY_MS);
    },
    [flush],
  );

  useEffect(() => {
    if (pending.current === null && !inFlight.current)
      lastSaved.current = saved;
  }, [saved]);

  useEffect(() => () => void flush(), [flush]);

  return { change, flush, status };
}
