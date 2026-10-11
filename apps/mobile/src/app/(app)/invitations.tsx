import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Avatar } from "@/components/avatar";
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Screen,
  Scroll,
} from "@/components/screen";
import { Txt } from "@/components/text";
import { Button, Group, Section, TextField } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import { relativeShort } from "@/lib/format";
import { qk, useAction } from "@/lib/query";
import { sessionStore } from "@/lib/session";
import { inset } from "@/theme";

/** Accepts either a raw invitation id or a link containing it (…/invitation/accept/<id>). */
function invitationIdFrom(input: string): string {
  const trimmed = input.trim();
  const match =
    /invitation[^/]*\/(?:accept\/)?([A-Za-z0-9_-]{8,})/.exec(trimmed) ??
    /([A-Za-z0-9_-]{8,})\/?$/.exec(trimmed);
  return match ? match[1] : trimmed;
}

export default function InvitationsScreen() {
  const { run, busy } = useAction();
  const query = useQuery({
    queryKey: qk.invitations,
    queryFn: api.pendingInvitations,
  });
  const [link, setLink] = useState("");
  const pending = (query.data ?? []).filter((i) => i.status === "pending");

  const accept = async (id: string, workspaceId?: string) => {
    const ok = await run(() => api.acceptInvitation(id), {
      success: "Invitation accepted",
    });
    if (ok !== undefined) {
      if (workspaceId)
        await sessionStore.updatePrefs({ lastWorkspaceId: workspaceId });
      router.dismissTo("/");
    }
  };

  return (
    <Screen>
      <Scroll
        bottomPadding={40}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
      >
        <PageHeader
          title="Invitations"
          description="Workspaces you've been invited to join."
        />
        <View style={{ paddingHorizontal: inset, paddingBottom: 24, gap: 10 }}>
          {query.isLoading ? (
            <Loading />
          ) : query.error ? (
            <ErrorState
              message={userMessage(query.error)}
              onRetry={() => void query.refetch()}
            />
          ) : pending.length === 0 ? (
            <Group>
              <EmptyState
                title="No pending invitations"
                message="Invitations appear here once your email address is verified. You can always join with the link from the email."
              />
            </Group>
          ) : (
            pending.map((inv) => (
              <Group key={inv.id} style={{ padding: 16, gap: 14 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Avatar name={inv.inviterName} size={32} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="body" weight="semibold">
                      {inv.workspaceName}
                    </Txt>
                    <Txt variant="meta" tone="muted">
                      {inv.inviterName} invited you
                    </Txt>
                  </View>
                  <Txt variant="caption" tone="faint">
                    {relativeShort(inv.createdAt)}
                  </Txt>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button
                    label="Decline"
                    kind="secondary"
                    size="md"
                    grow
                    onPress={() =>
                      run(() => api.rejectInvitation(inv.id), {
                        success: "Invitation declined",
                      })
                    }
                  />
                  <Button
                    label="Accept"
                    size="md"
                    grow
                    onPress={() => accept(inv.id, inv.workspaceId)}
                  />
                </View>
              </Group>
            ))
          )}
        </View>
        <Section title="Join with an invitation link">
          <Group style={{ padding: 14, gap: 10 }}>
            <TextField
              value={link}
              onChangeText={setLink}
              placeholder="Paste the link from your email"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ alignItems: "flex-end" }}>
              <Button
                label="Join"
                size="md"
                disabled={!link.trim()}
                loading={busy}
                onPress={() => accept(invitationIdFrom(link))}
              />
            </View>
          </Group>
        </Section>
      </Scroll>
    </Screen>
  );
}
