import { useNavigate } from "@tanstack/react-router";
import { Maximize2, MessagesSquare, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { useChatConversations } from "@/hooks/chat";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useChatStream } from "@/hooks/use-chat-stream";
import { cn } from "@/lib/cn";
import { useChatWidgetStore } from "@/store/chat-widget";
import { ChatPanel } from "./chat-panel";
import { OnlineAvatarStack, useOnlinePeople } from "./online-now";

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
  const onlinePeople = useOnlinePeople(workspace?.id);
  const sidebar = useSidebar();

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

  // Bottom left, just past the sidebar when it's open, so it never covers
  // the sidebar's own clock-in card.
  const left =
    sidebar.state === "expanded" && !sidebar.isMobile
      ? "calc(var(--sidebar-width) + 1rem)"
      : "1rem";

  return (
    <div
      style={{ left }}
      className="pointer-events-none fixed bottom-4 z-40 flex flex-col items-start gap-3 transition-[left] duration-200 ease-in-out"
    >
      {open && (
        <div
          role="dialog"
          aria-label={t("chat:title")}
          className="pointer-events-auto flex h-[min(580px,calc(100vh-6rem))] w-[min(380px,calc(100vw-2rem))] origin-bottom-left flex-col transition-[opacity,transform] starting:translate-y-2 starting:scale-95 starting:opacity-0 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl ring-1 ring-black/5 duration-150"
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
        className="pointer-events-auto relative flex h-11 items-center gap-2.5 rounded-full border border-border bg-background/95 ps-2 pe-4 text-sm shadow-lg backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {open ? (
            <X className="size-4" />
          ) : (
            <MessagesSquare className="size-3.5" />
          )}
        </span>
        <span className="font-medium">{t("chat:title")}</span>
        <OnlineAvatarStack people={onlinePeople} />
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              "size-2 rounded-full",
              onlinePeople.length > 0
                ? "bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/20"
                : "bg-muted-foreground/40",
            )}
          />
          {t("chat:onlineCount", { count: onlinePeople.length })}
        </span>
        {!open && unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white ring-2 ring-background">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}
