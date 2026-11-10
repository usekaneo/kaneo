import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { Conversation } from "./types.js";

export function useConversationScroll(
  conversation: Conversation,
  container: RefObject<HTMLDivElement | null>,
) {
  const thread = useRef<HTMLDivElement>(null);
  const unread = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const initialized = useRef(false);
  const [away, setAway] = useState(false);
  const [firstUnread] = useState(() => {
    let remaining = conversation.unreadCount ?? 0;
    if (remaining <= 0) return undefined;
    let first: string | undefined;
    for (
      let i = conversation.messages.length - 1;
      i >= 0 && remaining > 0;
      i--
    ) {
      const message = conversation.messages[i];
      if (!message.fromVisitor) {
        first = message.id;
        remaining--;
      }
    }
    return first;
  });
  const latest = conversation.messages[conversation.messages.length - 1]?.id;
  const jump = useCallback(() => {
    const node = container.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight });
    nearBottom.current = true;
    setAway(false);
  }, [container]);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const check = () => {
      nearBottom.current =
        node.scrollHeight - node.clientHeight - node.scrollTop <= 80;
      setAway(!nearBottom.current);
    };
    node.addEventListener("scroll", check, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            if (nearBottom.current) node.scrollTo({ top: node.scrollHeight });
          });
    if (thread.current) observer?.observe(thread.current);
    return () => {
      node.removeEventListener("scroll", check);
      observer?.disconnect();
    };
  }, [container]);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    if (!initialized.current && unread.current) {
      node.scrollTo({
        top:
          node.scrollTop +
          unread.current.getBoundingClientRect().top -
          node.getBoundingClientRect().top,
      });
      nearBottom.current =
        node.scrollHeight - node.clientHeight - node.scrollTop <= 80;
      setAway(!nearBottom.current);
    } else if (nearBottom.current) jump();
    initialized.current = true;
  }, [latest, container, jump]);
  return { thread, unread, firstUnread, away, jump };
}
