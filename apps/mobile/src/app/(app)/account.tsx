import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Avatar } from "@/components/avatar";
import { PageHeader, Screen, Scroll } from "@/components/screen";
import { ConfirmDialog, OptionSheet, Sheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { useToast } from "@/components/toast";
import {
  Button,
  Group,
  GroupRow,
  Section,
  Switch,
  TextField,
} from "@/components/ui";
import { DeleteAccountSheet } from "@/features/account/delete-account-sheet";
import { api } from "@/lib/api/endpoints";
import { signOut } from "@/lib/auth";
import {
  requestNotificationPermission,
  setBackgroundChecks,
} from "@/lib/background";
import { useMe } from "@/lib/hooks";
import { qk, useAction } from "@/lib/query";
import { sessionStore, usePrefs, useRequiredSession } from "@/lib/session";
import { pickImage } from "@/lib/upload";
import { useColors } from "@/theme";

export default function AccountScreen() {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const session = useRequiredSession();
  const prefs = usePrefs();
  const me = useMe();
  const client = useQueryClient();
  const toast = useToast();
  const { run } = useAction();
  const [photoMenu, setPhotoMenu] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Keep the cached name and email (shown offline and in mentions) in step with the server.
  useEffect(() => {
    if (
      me.data &&
      (me.data.name !== session.userName || me.data.email !== session.userEmail)
    ) {
      void sessionStore.updateUser(me.data.name, me.data.email);
    }
  }, [me.data, session.userName, session.userEmail]);

  const changePhoto = async () => {
    const asset = await pickImage({ square: true });
    if (!asset) return;
    await run(
      async () => {
        // Square, at most 512px, JPEG: what the web app uploads too.
        const context = ImageManipulator.manipulate(asset.uri);
        const side = Math.min(asset.width, asset.height, 512);
        context.resize({ width: side, height: side });
        const image = await context.renderAsync();
        const saved = await image.saveAsync({
          format: SaveFormat.JPEG,
          compress: 0.85,
          base64: true,
        });
        const avatar = await api.uploadAvatar({
          contentType: "image/jpeg",
          data: saved.base64 ?? "",
        });
        await api.updateUser({ image: avatar.url });
      },
      { success: t("mobile:account.toast.photoUpdated") },
    );
  };

  const toggleBackground = async (enabled: boolean) => {
    if (enabled && !(await requestNotificationPermission())) {
      toast.show(t("mobile:account.notifications.permissionDenied"), "error");
      return;
    }
    await sessionStore.updatePrefs({ backgroundNotifications: enabled });
    await setBackgroundChecks(enabled);
  };

  return (
    <Screen>
      <Scroll bottomPadding={40}>
        <PageHeader
          title={t("mobile:account.title")}
          description={t("mobile:account.description")}
        />

        <Section
          title={t("mobile:account.profile.title")}
          style={{ paddingBottom: 24 }}
        >
          <Group>
            <GroupRow style={{ paddingVertical: 14 }}>
              <Avatar
                name={me.data?.name ?? session.userName}
                image={me.data?.image}
                size={44}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="body" weight="medium">
                  {t("mobile:account.profile.photo")}
                </Txt>
                <Txt variant="caption" tone="faint">
                  {t("mobile:account.profile.photoFormats")}
                </Txt>
              </View>
              <Button
                label={t("mobile:account.profile.change")}
                kind="secondary"
                size="sm"
                onPress={() =>
                  me.data?.image ? setPhotoMenu(true) : changePhoto()
                }
              />
            </GroupRow>
            <View
              style={{
                padding: 14,
                gap: 6,
                borderBottomWidth: 1,
                borderBottomColor: c.divider,
              }}
            >
              {me.data ? (
                <NameField
                  key={me.data.id}
                  initial={me.data.name}
                  onSave={(next) =>
                    run(() => api.updateUser({ name: next }), {
                      success: t("mobile:account.toast.nameUpdated"),
                    })
                  }
                />
              ) : (
                <TextField
                  label={t("mobile:account.profile.name")}
                  value={session.userName}
                  editable={false}
                />
              )}
            </View>
            <GroupRow last onPress={() => setChangingPassword(true)}>
              <Txt variant="body" style={{ flex: 1 }}>
                {t("mobile:account.profile.changePassword")}
              </Txt>
              <ChevronRight size={16} color={c.placeholder} />
            </GroupRow>
          </Group>
        </Section>

        <Section
          title={t("mobile:account.notifications.title")}
          style={{ paddingBottom: 24 }}
        >
          <Group>
            <GroupRow>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="body">
                  {t("mobile:account.notifications.phone")}
                </Txt>
                <Txt variant="caption" tone="faint">
                  {t("mobile:account.notifications.phoneHint")}
                </Txt>
              </View>
              <Switch
                value={prefs.backgroundNotifications}
                onChange={toggleBackground}
              />
            </GroupRow>
            <GroupRow onPress={() => router.push("/notification-settings")}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="body">
                  {t("mobile:account.notifications.delivery")}
                </Txt>
                <Txt variant="caption" tone="faint">
                  {t("mobile:account.notifications.deliveryHint")}
                </Txt>
              </View>
              <ChevronRight size={16} color={c.placeholder} />
            </GroupRow>
            <GroupRow last onPress={() => router.push("/invitations")}>
              <Txt variant="body" style={{ flex: 1 }}>
                {t("mobile:account.notifications.invitations")}
              </Txt>
              <ChevronRight size={16} color={c.placeholder} />
            </GroupRow>
          </Group>
        </Section>

        <Section
          title={t("mobile:account.connection.title")}
          style={{ paddingBottom: 24 }}
        >
          <Group>
            <GroupRow>
              <Txt variant="body" tone="muted" style={{ flex: 1 }}>
                {t("mobile:account.connection.server")}
              </Txt>
              <Txt variant="monoMd" style={{ fontSize: 12 }} numberOfLines={1}>
                {session.serverUrl.replace(/^https?:\/\//, "")}
              </Txt>
            </GroupRow>
            <GroupRow>
              <Txt variant="body" tone="muted" style={{ flex: 1 }}>
                {t("mobile:account.connection.signedInWith")}
              </Txt>
              <Txt variant="bodySm">
                {session.credentialType === "apiKey"
                  ? t("mobile:account.connection.apiKey")
                  : t("mobile:account.connection.sessionToken")}
              </Txt>
            </GroupRow>
            <GroupRow last>
              <Txt variant="body" tone="muted" style={{ flex: 1 }}>
                {t("mobile:account.connection.appVersion")}
              </Txt>
              <Txt variant="monoMd" style={{ fontSize: 12 }}>
                {Constants.expoConfig?.version ?? "1.0.0"}
              </Txt>
            </GroupRow>
          </Group>
        </Section>

        <Section
          title={t("mobile:account.deleteAccount.sectionTitle")}
          style={{ paddingBottom: 24 }}
        >
          <Group>
            <GroupRow last onPress={() => setDeletingAccount(true)}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="body" tone="danger">
                  {t("mobile:account.deleteAccount.title")}
                </Txt>
                <Txt variant="caption" tone="faint">
                  {t("mobile:account.deleteAccount.description")}
                </Txt>
              </View>
              <ChevronRight size={16} color={c.placeholder} />
            </GroupRow>
          </Group>
        </Section>

        <View style={{ paddingHorizontal: 16 }}>
          <Button
            label={t("mobile:account.signOut.button")}
            kind="dangerOutline"
            onPress={() => setConfirmSignOut(true)}
          />
        </View>
      </Scroll>

      <OptionSheet
        visible={photoMenu}
        onClose={() => setPhotoMenu(false)}
        title={t("mobile:account.profile.photo")}
        options={[
          { value: "change", label: t("mobile:account.photoMenu.choose") },
          {
            value: "remove",
            label: t("mobile:account.photoMenu.remove"),
            tone: "danger" as const,
          },
        ]}
        onSelect={(v) => {
          if (v === "change") void changePhoto();
          else
            void run(
              async () => {
                await api.deleteAvatar();
                await api.updateUser({ image: null });
              },
              { success: t("mobile:account.toast.photoRemoved") },
            );
        }}
      />
      <ChangePasswordSheet
        visible={changingPassword}
        onClose={() => setChangingPassword(false)}
      />
      <DeleteAccountSheet
        visible={deletingAccount}
        email={me.data?.email ?? session.userEmail}
        onClose={() => setDeletingAccount(false)}
      />
      <ConfirmDialog
        visible={confirmSignOut}
        title={t("mobile:account.signOut.title")}
        message={t("mobile:account.signOut.message")}
        confirmLabel={t("mobile:account.signOut.button")}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={async () => {
          await signOut();
          client.clear();
          void client.invalidateQueries({ queryKey: qk.me });
        }}
      />
    </Screen>
  );
}

function NameField({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (name: string) => void;
}) {
  const { t } = useTranslation(["mobile"]);
  const [name, setName] = useState(initial);
  const save = () => {
    const next = name.trim();
    if (next && next !== initial) onSave(next);
  };
  return (
    <TextField
      label={t("mobile:account.profile.name")}
      value={name}
      onChangeText={setName}
      onBlur={save}
      onSubmitEditing={save}
      returnKeyType="done"
    />
  );
}

function strength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

function ChangePasswordSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation(["mobile"]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t("mobile:account.password.title")}
    >
      <ChangePasswordForm onDone={onClose} />
    </Sheet>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const session = useRequiredSession();
  const { run, busy } = useAction();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [revoke, setRevoke] = useState(true);
  const score = strength(next);
  const mismatch = !!confirm && confirm !== next;

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 14 }}>
      <TextField
        label={t("mobile:account.password.current")}
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoFocus
      />
      <View style={{ gap: 6 }}>
        <TextField
          label={t("mobile:account.password.new")}
          value={next}
          onChangeText={setNext}
          secureTextEntry
        />
        <View style={{ flexDirection: "row", gap: 4 }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor:
                  i < score ? (score >= 3 ? c.successFg : c.warningFg) : c.fill,
              }}
            />
          ))}
        </View>
      </View>
      <TextField
        label={t("mobile:account.password.confirm")}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        placeholder={t("mobile:account.password.confirmPlaceholder")}
        error={mismatch ? t("mobile:account.password.mismatch") : null}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Txt variant="bodySm">{t("mobile:account.password.signOutOthers")}</Txt>
        <Switch value={revoke} onChange={setRevoke} />
      </View>
      <Button
        label={t("mobile:account.password.title")}
        loading={busy}
        disabled={!current || next.length < 8 || next !== confirm}
        onPress={async () => {
          const result = await run(
            () =>
              api.changePassword({
                currentPassword: current,
                newPassword: next,
                revokeOtherSessions: revoke,
              }),
            {
              success: t("mobile:account.toast.passwordChanged"),
              refresh: false,
            },
          );
          if (result !== undefined) {
            // Revoking other sessions also replaces this one; keep the fresh token.
            if (result?.token)
              await sessionStore.save({ ...session, token: result.token });
            onDone();
          }
        }}
      />
    </View>
  );
}
