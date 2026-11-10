import { useEffect, useRef, useState } from "react";
import {
  emptySnapshot,
  type MockBackend,
  type WidgetSnapshot,
} from "./mock-backend.js";

/** The production adapter described by the RFC replaces this hook, not the UI. */
export function useMockWidget(
  backend: MockBackend,
  visitor: string,
  loadFailure: boolean,
) {
  const [result, setResult] = useState({
    visitor,
    data: emptySnapshot,
    state: "loading" as "loading" | "ready" | "error",
  });
  const controller = useRef(new AbortController());
  const activeVisitor = useRef(visitor);
  activeVisitor.current = visitor;
  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    setResult({ visitor, data: emptySnapshot, state: "loading" });
    if (loadFailure)
      setResult({ visitor, data: emptySnapshot, state: "error" });
    else
      void backend
        .load(visitor, abort.signal)
        .then((data) => {
          if (!abort.signal.aborted)
            setResult({ visitor, data, state: "ready" });
        })
        .catch(() => {
          if (!abort.signal.aborted)
            setResult({ visitor, data: emptySnapshot, state: "error" });
        });
    return () => abort.abort();
  }, [backend, visitor, loadFailure]);
  const perform = async (
    action: (signal: AbortSignal) => Promise<WidgetSnapshot>,
  ) => {
    const abort = controller.current;
    const data = await action(abort.signal);
    if (!abort.signal.aborted && activeVisitor.current === visitor)
      setResult({ visitor, data, state: "ready" });
  };
  return {
    data: result.visitor === visitor ? result.data : emptySnapshot,
    loadState: result.visitor === visitor ? result.state : ("loading" as const),
    perform,
    reload: () => perform((signal) => backend.load(visitor, signal)),
  };
}
