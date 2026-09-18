import { useNavigate } from "@tanstack/react-router";
import { Maximize2, MessagesSquare, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useChatConversations } from "@/hooks/chat";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useChatWidgetStore } from "@/store/chat-widget";
import { ChatPanel } from "./chat-panel";

/** Floating chat bubble, shown on every workspace page except Chat itself. */
export function ChatWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: workspace } = useActiveWorkspace();
  const { open, conversationId, setOpen, openConversation } =
    useChatWidgetStore();
  const { data: conversations = [] } = useChatConversations(workspace?.id);
  // Mounted on every workspace page (the Chat page included), so the stream
  // keeps badges and open conversations live everywhere.
  useChatStream(workspace?.id);

  if (!workspace) return null;
  if (window.location.pathname.endsWith(`/workspace/${workspace.id}/chat`)) {
    return null;
  }

  const unread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  // A conversation from another workspace (or one since deleted) isn't shown.
  const activeId = conversations.some((c) => c.id === conversationId)
    ? conversationId
    : null;

  const actions = (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("chat:openFull")}
        title={t("chat:openFull")}
        onClick={() => {
          setOpen(false);
          void navigate({
            to: "/dashboard/workspace/$workspaceId/chat",
            params: { workspaceId: workspace.id },
            search: activeId ? { c: activeId } : {},
          });
        }}
      >
        <Maximize2 className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("chat:close")}
        onClick={() => setOpen(false)}
      >
        <X className="size-4" />
      </Button>
    </>
  );

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <div
          role="dialog"
          aria-label={t("chat:title")}
          className="pointer-events-auto flex h-[min(560px,calc(100vh-6rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
        >
          <ChatPanel
            variant="widget"
            workspaceId={workspace.id}
            activeId={activeId}
            onSelect={openConversation}
            headerActions={actions}
          />
        </div>
      )}
      <button
        type="button"
        aria-label={
          unread > 0
            ? t("chat:openWithUnread", { count: unread })
            : t("chat:title")
        }
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="pointer-events-auto relative flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {open ? (
          <X className="size-5" />
        ) : (
          <MessagesSquare className="size-5" />
        )}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white ring-2 ring-background">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}
