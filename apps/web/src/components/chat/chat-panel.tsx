import { ArrowLeft, MessagesSquare, SquarePen } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useChatConversations } from "@/hooks/chat";
import { cn } from "@/lib/cn";
import { ConversationList } from "./conversation-list";
import { ConversationView } from "./conversation-view";
import {
  NewConversationDialog,
  type NewConversationMode,
} from "./new-conversation-dialog";
import { OnlineNow } from "./online-now";

type Props = {
  workspaceId: string;
  activeId: string | null;
  onSelect: (id: string | null) => void;
  /**
   * "page" shows the list and the conversation side by side; "widget" shows
   * one at a time, with a back arrow from the conversation to the list.
   */
  variant: "page" | "widget";
  /** Controls at the end of every header, e.g. the widget's expand/close. */
  headerActions?: ReactNode;
};

export function ChatPanel({
  workspaceId,
  activeId,
  onSelect,
  variant,
  headerActions,
}: Props) {
  const { t } = useTranslation();
  const { data: conversations = [] } = useChatConversations(workspaceId);
  const [dialog, setDialog] = useState<NewConversationMode | null>(null);
  const active = conversations.find((c) => c.id === activeId) ?? null;
  const widget = variant === "widget";
  const newMessageButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t("chat:newMessage")}
      title={t("chat:newMessage")}
      onClick={() => setDialog({ kind: "dm" })}
    >
      <SquarePen className="size-4" />
    </Button>
  );

  const list = (
    <ConversationList
      conversations={conversations}
      activeId={activeId}
      onSelect={onSelect}
      onNewChannel={() => setDialog({ kind: "channel" })}
      onNewMessage={() => setDialog({ kind: "dm" })}
    />
  );

  const view = active ? (
    <ConversationView
      key={active.id}
      workspaceId={workspaceId}
      conversation={active}
      compact={widget}
      onClosed={() => onSelect(null)}
      onAddPeople={() =>
        setDialog({
          kind: "add",
          conversationId: active.id,
          existingIds: active.members.map((m) => m.id),
        })
      }
      leading={
        // The page shows the list beside the conversation from md upwards.
        <Button
          variant="ghost"
          size="icon-xs"
          className={widget ? undefined : "md:hidden"}
          aria-label={t("chat:back")}
          onClick={() => onSelect(null)}
        >
          <ArrowLeft className="size-4" />
        </Button>
      }
      trailing={widget ? headerActions : null}
    />
  ) : (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessagesSquare />
        </EmptyMedia>
        <EmptyTitle>{t("chat:pickTitle")}</EmptyTitle>
        <EmptyDescription>{t("chat:pickDescription")}</EmptyDescription>
      </EmptyHeader>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialog({ kind: "channel" })}
        >
          {t("chat:newChannel")}
        </Button>
        <Button size="sm" onClick={() => setDialog({ kind: "dm" })}>
          {t("chat:newMessage")}
        </Button>
      </div>
    </Empty>
  );

  return (
    <>
      {widget ? (
        <div className="flex h-full min-h-0 flex-col">
          {active ? (
            view
          ) : (
            <>
              <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
                <h2 className="flex-1 text-sm font-semibold">
                  {t("chat:title")}
                </h2>
                {newMessageButton}
                {headerActions}
              </header>
              <OnlineNow workspaceId={workspaceId} onOpened={onSelect} />
              <div className="min-h-0 flex-1">{list}</div>
            </>
          )}
        </div>
      ) : (
        <div className="flex h-full min-h-0">
          <aside
            className={cn(
              "flex w-full shrink-0 flex-col border-e border-border bg-muted/20 md:w-72",
              active && "hidden md:flex",
            )}
          >
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
              <MessagesSquare className="size-4 text-muted-foreground" />
              <h2 className="flex-1 text-sm font-semibold">
                {t("chat:title")}
              </h2>
              {newMessageButton}
            </header>
            <OnlineNow workspaceId={workspaceId} onOpened={onSelect} />
            <div className="min-h-0 flex-1">{list}</div>
          </aside>
          <div className={cn("min-w-0 flex-1", !active && "hidden md:block")}>
            {view}
          </div>
        </div>
      )}
      <NewConversationDialog
        workspaceId={workspaceId}
        mode={dialog}
        onClose={() => setDialog(null)}
        onOpened={(id) => onSelect(id)}
      />
    </>
  );
}
