import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useChatActions, useOnlineUserIds } from "@/hooks/chat";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { PersonAvatar } from "./chat-shared";

export type NewConversationMode =
  | { kind: "channel" }
  | { kind: "dm" }
  | { kind: "add"; conversationId: string; existingIds: string[] };

type Props = {
  workspaceId: string;
  mode: NewConversationMode | null;
  onClose: () => void;
  onOpened: (conversationId: string) => void;
};

export function NewConversationDialog({
  workspaceId,
  mode,
  onClose,
  onOpened,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data } = useGetActiveWorkspaceUsers(workspaceId);
  const members = useMemo(() => data?.members ?? [], [data]);
  const actions = useChatActions(workspaceId);
  const online = useOnlineUserIds(workspaceId);
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const reset = () => {
    setName("");
    setIsPrivate(false);
    setSearch("");
    setPicked([]);
  };
  const close = () => {
    reset();
    onClose();
  };

  const people = useMemo(() => {
    const excluded = new Set([
      user?.id,
      ...(mode?.kind === "add" ? mode.existingIds : []),
    ]);
    const query = search.trim().toLowerCase();
    return (
      members
        .filter((m) => !excluded.has(m.userId))
        .filter(
          (m) =>
            !query ||
            m.user.name?.toLowerCase().includes(query) ||
            m.user.email?.toLowerCase().includes(query),
        )
        // Online people first; the sort is stable, so names keep their order.
        .sort(
          (a, b) => Number(online.has(b.userId)) - Number(online.has(a.userId)),
        )
    );
  }, [members, search, user?.id, mode, online]);

  const toggle = (id: string) =>
    setPicked((all) =>
      all.includes(id) ? all.filter((p) => p !== id) : [...all, id],
    );

  const pending =
    actions.createChannel.isPending ||
    actions.openDm.isPending ||
    actions.addMembers.isPending;
  const canSubmit =
    mode?.kind === "channel" ? name.trim().length > 0 : picked.length > 0;

  const submit = async () => {
    if (!mode || !canSubmit) return;
    try {
      if (mode.kind === "channel") {
        const { id } = await actions.createChannel.mutateAsync({
          name,
          isPrivate,
          memberIds: picked,
        });
        onOpened(id);
      } else if (mode.kind === "dm") {
        const { id } = await actions.openDm.mutateAsync(picked);
        onOpened(id);
      } else {
        await actions.addMembers.mutateAsync({
          id: mode.conversationId,
          userIds: picked,
        });
      }
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("chat:error"));
    }
  };

  const title =
    mode?.kind === "channel"
      ? t("chat:newChannel")
      : mode?.kind === "dm"
        ? t("chat:newMessage")
        : t("chat:addPeople");

  return (
    <Dialog open={mode !== null} onOpenChange={(next) => !next && close()}>
      <DialogPopup className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          {mode?.kind === "channel" && (
            <>
              <Input
                autoFocus
                placeholder={t("chat:channelNamePlaceholder")}
                aria-label={t("chat:channelName")}
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="block font-medium">
                    {t("chat:privateChannel")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t("chat:privateChannelHint")}
                  </span>
                </span>
                <Switch
                  aria-label={t("chat:privateChannel")}
                  checked={isPrivate}
                  onCheckedChange={(checked) => setIsPrivate(checked)}
                />
              </div>
            </>
          )}
          {mode?.kind === "dm" && (
            <p className="text-xs text-muted-foreground">{t("chat:dmHint")}</p>
          )}
          <Input
            autoFocus={mode?.kind !== "channel"}
            placeholder={t("chat:searchPeople")}
            aria-label={t("chat:searchPeople")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            {people.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                {t("chat:noPeople")}
              </p>
            ) : (
              people.map((m) => {
                const selected = picked.includes(m.userId);
                return (
                  <button
                    key={m.userId}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggle(m.userId)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent/60",
                      selected && "bg-accent/40",
                    )}
                  >
                    <PersonAvatar
                      name={m.user.name ?? null}
                      image={m.user.image ?? null}
                      online={online.has(m.userId)}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {m.user.name}
                      <span className="ms-2 text-xs text-muted-foreground">
                        {m.user.email}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-xs",
                        online.has(m.userId)
                          ? "text-emerald-500"
                          : "text-muted-foreground",
                      )}
                    >
                      {online.has(m.userId)
                        ? t("chat:online")
                        : t("chat:offline")}
                    </span>
                    {selected && <Check className="size-4 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={close}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!canSubmit || pending}
            onClick={() => void submit()}
          >
            {mode?.kind === "channel"
              ? t("chat:create")
              : mode?.kind === "dm"
                ? t("chat:start")
                : t("chat:add")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
