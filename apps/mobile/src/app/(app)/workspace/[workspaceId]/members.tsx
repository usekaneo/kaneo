import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ChevronDown, Mail, Plus } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { Avatar } from "@/components/avatar";
import {
  ErrorState,
  Loading,
  PageHeader,
  Screen,
  Scroll,
} from "@/components/screen";
import { ConfirmDialog, OptionSheet, Sheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import {
  Button,
  Group,
  GroupRow,
  Radio,
  Section,
  TextField,
  Touch,
} from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type {
  OrganizationInvitation,
  OrganizationMember,
} from "@/lib/api/types";
import { relativeLong } from "@/lib/format";
import { useWorkspaces } from "@/lib/hooks";
import { qk, useAction } from "@/lib/query";
import { useRequiredSession } from "@/lib/session";
import {
  canManageWorkspace,
  hasRole,
  ROLE_HINTS,
  roleLabel,
  WORKSPACE_ROLES,
} from "@/lib/style";
import { useColors } from "@/theme";

export default function MembersScreen() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const c = useColors();
  const session = useRequiredSession();
  const { run } = useAction();
  const org = useQuery({
    queryKey: qk.fullWorkspace(workspaceId),
    queryFn: () => api.fullWorkspace(workspaceId),
  });
  const rolesQuery = useQuery({
    queryKey: qk.roles(workspaceId),
    queryFn: () => api.workspaceRoles(workspaceId),
  });
  const workspaces = useWorkspaces();
  const workspace = workspaces.data?.find((w) => w.id === workspaceId);
  const canManage = canManageWorkspace(
    workspace?.role ??
      org.data?.members?.find((m) => m.userId === session.userId)?.role,
  );
  const roles = [
    ...WORKSPACE_ROLES,
    ...(rolesQuery.data ?? [])
      .map((r) => r.role)
      .filter((r) => r !== "owner" && !WORKSPACE_ROLES.includes(r)),
  ];
  const [inviting, setInviting] = useState(false);
  const [memberMenu, setMemberMenu] = useState<OrganizationMember | null>(null);
  const [rolePicker, setRolePicker] = useState<OrganizationMember | null>(null);
  const [removing, setRemoving] = useState<OrganizationMember | null>(null);
  const [inviteMenu, setInviteMenu] = useState<OrganizationInvitation | null>(
    null,
  );

  const members = [...(org.data?.members ?? [])].sort((a, b) =>
    hasRole(a.role, "owner")
      ? -1
      : hasRole(b.role, "owner")
        ? 1
        : (a.user?.name ?? "").localeCompare(b.user?.name ?? ""),
  );
  const pending = (org.data?.invitations ?? []).filter(
    (i) => i.status === "pending",
  );

  return (
    <Screen>
      <Scroll
        bottomPadding={40}
        refreshing={org.isRefetching}
        onRefresh={() => void org.refetch()}
      >
        <PageHeader
          title="Members"
          description={`${members.length} ${members.length === 1 ? "person" : "people"} in ${workspace?.name ?? org.data?.name ?? "this workspace"}`}
          action={
            canManage ? (
              <Button
                label="Invite"
                size="sm"
                icon={<Plus size={14} color={c.onPrimary} />}
                onPress={() => setInviting(true)}
                style={{ height: 36 }}
              />
            ) : undefined
          }
        />
        {org.isLoading ? (
          <Loading />
        ) : !org.data ? (
          <ErrorState
            message={userMessage(org.error)}
            onRetry={() => void org.refetch()}
          />
        ) : (
          <>
            {pending.length ? (
              <Section
                title="Pending invitations"
                style={{ paddingBottom: 24 }}
              >
                <Group>
                  {pending.map((inv, i) => (
                    <GroupRow
                      key={inv.id}
                      last={i === pending.length - 1}
                      onPress={canManage ? () => setInviteMenu(inv) : undefined}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderStyle: "dashed",
                          borderColor: c.fillStrong,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Mail size={14} color={c.faint} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Txt variant="body" numberOfLines={1}>
                          {inv.email}
                        </Txt>
                        <Txt variant="caption" tone="faint">
                          {roleLabel(inv.role ?? "member")}
                          {inv.expiresAt
                            ? `, expires ${relativeLong(inv.expiresAt) || "soon"}`
                            : ""}
                        </Txt>
                      </View>
                      {canManage ? (
                        <Txt variant="meta" weight="medium" tone="muted">
                          Manage
                        </Txt>
                      ) : null}
                    </GroupRow>
                  ))}
                </Group>
              </Section>
            ) : null}
            <Section title="People">
              <Group>
                {members.map((m, i) => {
                  const isSelf = m.userId === session.userId;
                  const editable =
                    canManage && !hasRole(m.role, "owner") && !isSelf;
                  return (
                    <GroupRow
                      key={m.id}
                      last={i === members.length - 1}
                      onPress={editable ? () => setMemberMenu(m) : undefined}
                    >
                      <Avatar
                        name={m.user?.name}
                        image={m.user?.image}
                        size={32}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Txt variant="body" numberOfLines={1}>
                          {m.user?.name ?? "Unknown"}
                          {isSelf ? (
                            <Txt variant="body" tone="faint">
                              {" "}
                              (you)
                            </Txt>
                          ) : null}
                        </Txt>
                        <Txt variant="caption" tone="faint" numberOfLines={1}>
                          {m.user?.email}
                        </Txt>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingRight: editable ? 0 : 16,
                        }}
                      >
                        <Txt
                          variant="meta"
                          weight="medium"
                          tone={hasRole(m.role, "owner") ? "ink" : "muted"}
                        >
                          {roleLabel(m.role)}
                        </Txt>
                        {editable ? (
                          <ChevronDown size={12} color={c.faint} />
                        ) : null}
                      </View>
                    </GroupRow>
                  );
                })}
              </Group>
            </Section>
          </>
        )}
      </Scroll>

      <InviteSheet
        visible={inviting}
        onClose={() => setInviting(false)}
        workspaceId={workspaceId}
        workspaceName={workspace?.name ?? ""}
        roles={roles}
      />
      <OptionSheet
        visible={!!memberMenu}
        onClose={() => setMemberMenu(null)}
        title={memberMenu?.user?.name ?? "Member"}
        options={[
          { value: "role", label: "Change role" },
          {
            value: "remove",
            label: "Remove from workspace",
            tone: "danger" as const,
          },
        ]}
        onSelect={(v) =>
          v === "role" ? setRolePicker(memberMenu) : setRemoving(memberMenu)
        }
      />
      <OptionSheet
        visible={!!rolePicker}
        onClose={() => setRolePicker(null)}
        title="Role"
        selected={rolePicker?.role}
        options={roles.map((r) => ({
          value: r,
          label: roleLabel(r),
          hint: ROLE_HINTS[r] ?? null,
        }))}
        onSelect={(role) =>
          rolePicker &&
          run(() => api.updateMemberRole(workspaceId, rolePicker.id, role), {
            success: "Role updated",
          })
        }
      />
      <ConfirmDialog
        visible={!!removing}
        title="Remove member?"
        message={`${removing?.user?.name ?? "They"} will lose access to ${workspace?.name ?? "this workspace"}.`}
        confirmLabel="Remove"
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          run(
            () =>
              api.removeMember(
                workspaceId,
                removing.user?.email ?? removing.id,
              ),
            { success: "Member removed" },
          )
        }
      />
      <OptionSheet
        visible={!!inviteMenu}
        onClose={() => setInviteMenu(null)}
        title={inviteMenu?.email ?? "Invitation"}
        options={[
          { value: "resend", label: "Resend invitation" },
          {
            value: "cancel",
            label: "Cancel invitation",
            tone: "danger" as const,
          },
        ]}
        onSelect={(v) => {
          const inv = inviteMenu;
          if (!inv) return;
          if (v === "resend")
            void run(
              () =>
                api.inviteMember({
                  organizationId: workspaceId,
                  email: inv.email,
                  role: inv.role ?? "member",
                  resend: true,
                }),
              {
                success: "Invitation resent",
              },
            );
          else
            void run(() => api.cancelInvitation(inv.id), {
              success: "Invitation canceled",
            });
        }}
      />
    </Screen>
  );
}

function InviteSheet({
  visible,
  onClose,
  workspaceId,
  workspaceName,
  roles,
}: {
  visible: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
  roles: string[];
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Invite member">
      <InviteForm
        onDone={onClose}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        roles={roles}
      />
    </Sheet>
  );
}

function InviteForm({
  onDone,
  workspaceId,
  workspaceName,
  roles,
}: {
  onDone: () => void;
  workspaceId: string;
  workspaceName: string;
  roles: string[];
}) {
  const c = useColors();
  const { run, busy } = useAction();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <>
      <View style={{ paddingHorizontal: 20, marginTop: -8, paddingBottom: 16 }}>
        <Txt variant="meta" tone="muted" style={{ lineHeight: 18 }}>
          They’ll get an email with a link to join {workspaceName}.
        </Txt>
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 16 }}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoFocus
        />
        <View style={{ gap: 6 }}>
          <Txt variant="meta" weight="medium" tone="body">
            Role
          </Txt>
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: c.hairline,
              overflow: "hidden",
            }}
          >
            {roles.map((r, i) => (
              <Touch
                key={r}
                onPress={() => setRole(r)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: c.divider,
                }}
              >
                <Radio selected={role === r} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="body">{roleLabel(r)}</Txt>
                  {ROLE_HINTS[r] ? (
                    <Txt variant="caption" tone="faint">
                      {ROLE_HINTS[r]}
                    </Txt>
                  ) : null}
                </View>
              </Touch>
            ))}
          </View>
        </View>
        <Button
          label="Send invite"
          loading={busy}
          disabled={!valid}
          onPress={async () => {
            const ok = await run(
              () =>
                api.inviteMember({
                  organizationId: workspaceId,
                  email: email.trim(),
                  role,
                }),
              {
                success: `Invitation sent to ${email.trim()}`,
              },
            );
            if (ok !== undefined) onDone();
          }}
        />
      </View>
    </>
  );
}
