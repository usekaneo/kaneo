import { useEffect, useRef, useState } from "react";
import type { Highlighter } from "shiki";

export function useEditorHighlighter() {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const highlighterRef = useRef<Highlighter | null>(null);
  const [languages, setLanguages] = useState(() => new Set<string>(["text"]));
  useEffect(() => {
    let disposed = false;
    void Promise.all([
      import("@/lib/shiki-highlighter").then(({ getSharedShikiHighlighter }) =>
        getSharedShikiHighlighter(),
      ),
      import("shiki"),
    ])
      .then(([instance, { bundledLanguages }]) => {
        if (disposed) return;
        highlighterRef.current = instance;
        setHighlighter(instance);
        setLanguages(new Set([...Object.keys(bundledLanguages), "text"]));
      })
      .catch((error) =>
        console.error("Failed to initialize Shiki highlighter:", error),
      );
    return () => {
      disposed = true;
    };
  }, []);
  return { highlighter, highlighterRef, languages };
}
