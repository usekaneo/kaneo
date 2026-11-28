import { useCallback, useEffect, useMemo, useRef } from "react";
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollViewInstance,
} from "react-native";

import type { FormatStore } from "./format-store";

const BELOW = 32;
const ABOVE = 96;

export function useCaretFollow(active: boolean, formats: FormatStore) {
  const scroll = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  const viewport = useRef(0);
  const editorTop = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;

  const follow = useCallback(() => {
    if (!activeRef.current || !viewport.current) return;
    const caret = editorTop.current + formats.get().caretBottom;
    if (caret + BELOW > offset.current + viewport.current)
      scroll.current?.scrollTo({ y: caret + BELOW - viewport.current });
    else if (caret - ABOVE / 2 < offset.current)
      scroll.current?.scrollTo({ y: Math.max(0, caret - ABOVE) });
  }, [formats]);

  useEffect(() => formats.subscribe(follow), [formats, follow]);
  useEffect(() => {
    if (active) follow();
  }, [active, follow]);

  const scrollProps = useMemo(
    () => ({
      ref: scroll,
      scrollEventThrottle: 16,
      onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        offset.current = e.nativeEvent.contentOffset.y;
      },
      onLayout: (e: LayoutChangeEvent) => {
        viewport.current = e.nativeEvent.layout.height;
        follow();
      },
    }),
    [follow],
  );
  const onEditorLayout = useCallback((e: LayoutChangeEvent) => {
    editorTop.current = e.nativeEvent.layout.y;
  }, []);

  return { scrollProps, onEditorLayout };
}
