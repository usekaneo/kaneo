import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { useChatActions, useOnlineUserIds } from "@/hooks/chat";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { PersonAvatar } from "./chat-shared";

export type OnlinePerson = {
  id: string;
  name: string | null;
  image: string | null;
};

/** Everyone online in the workspace except you, by name. */
export function useOnlinePeople(workspaceId: string | undefined) {
  const { user } = useAuth();
  const { data } = useGetActiveWorkspaceUsers(workspaceId ?? "");
  const online = useOnlineUserIds(workspaceId);
  return useMemo<OnlinePerson[]>(
    () =>
      (data?.members ?? [])
        .filter((m) => m.userId !== user?.id && online.has(m.userId))
        .map((m) => ({
          id: m.userId,
          name: m.user.name ?? null,
          image: m.user.image ?? null,
        }))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [data, online, user?.id],
  );
}

/** Up to three overlapping faces, for a compact "who's here" hint. */
export function OnlineAvatarStack({
  people,
  className,
}: {
  people: OnlinePerson[];
  className?: string;
}) {
  if (people.length === 0) return null;
  return (
    <span className={cn("flex -space-x-1.5", className)}>
      {people.slice(0, 3).map((p) => (
        <PersonAvatar
          key={p.id}
          name={p.name}
          image={p.image}
          className="size-6 rounded-full ring-2 ring-background"
        />
      ))}
    </span>
  );
}

/** A row of people online now; clicking one opens a direct message. */
export function OnlineNow({
  workspaceId,
  onOpened,
}: {
  workspaceId: string;
  onOpened: (conversationId: string) => void;
}) {
  const { t } = useTranslation();
  const people = useOnlinePeople(workspaceId);
  const { openDm } = useChatActions(workspaceId);

  const message = async (userId: string) => {
    try {
      const { id } = await openDm.mutateAsync([userId]);
      onOpened(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("chat:error"));
    }
  };

  return (
    <section
      aria-label={t("chat:onlineNow")}
      className="border-b border-border px-3 py-2.5"
    >
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {t("chat:onlineNow")}
        <span className="tabular-nums">{people.length}</span>
      </h3>
      {people.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("chat:nobodyOnline")}
        </p>
      ) : (
        <ul className="flex gap-1 overflow-x-auto pb-0.5">
          {people.map((p) => (
            <li key={p.id} className="shrink-0">
              <button
                type="button"
                title={t("chat:messagePerson", { name: p.name })}
                disabled={openDm.isPending}
                onClick={() => void message(p.id)}
                className="flex w-14 flex-col items-center gap-1 rounded-lg p-1 text-center hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <PersonAvatar
                  name={p.name}
                  image={p.image}
                  online
                  className="size-9 rounded-full"
                />
                <span className="w-full truncate text-[11px]">
                  {p.name?.split(" ")[0]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
