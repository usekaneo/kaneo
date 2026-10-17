import { ArrowUp, AtSign, Image as ImageIcon } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, TextInput, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { useBottomInset } from "@/components/screen";
import { OptionSheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { IconButton, Touch } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type { WorkspaceMember } from "@/lib/api/types";
import { mentionTag } from "@/lib/markdown";
import { useAction } from "@/lib/query";
import { uploadTaskImage } from "@/lib/upload";
import { font, useColors } from "@/theme";

/** Comment input docked above the keyboard, with @mentions and image attachments. */
export function Composer({
  taskId,
  members,
  replyTo,
}: {
  taskId: string;
  members: WorkspaceMember[];
  replyTo?: string | null;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const bottom = useBottomInset(6);
  const toast = useToast();
  const { run, busy } = useAction();
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<Record<string, string>>({}); // display name -> user id
  const [picker, setPicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  const send = async () => {
    let body = text.trim();
    // Turn picked "@Name" mentions into the tag the server parses for notifications.
    Object.entries(mentions).forEach(([name, id]) => {
      body = body.split(`@${name}`).join(mentionTag(id, name));
    });
    const ok = await run(() => api.createComment(taskId, body));
    if (ok !== undefined) {
      setText("");
      setMentions({});
    }
  };

  const attach = async () => {
    setUploading(true);
    try {
      const md = await uploadTaskImage(taskId, "comment");
      if (md) setText((t) => `${t.trimEnd()}\n${md}\n`.trimStart());
    } catch (e) {
      toast.show(userMessage(e), "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.hairline,
        paddingBottom: bottom,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 8,
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 6,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "flex-end",
            minHeight: 44,
            paddingLeft: 14,
            paddingRight: 4,
            borderRadius: 12,
            backgroundColor: c.input,
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={
              replyTo
                ? t("mobile:composer.reply", { name: replyTo })
                : t("mobile:composer.placeholder")
            }
            placeholderTextColor={c.faint}
            selectionColor={c.ink}
            multiline
            style={{
              flex: 1,
              color: c.ink,
              fontFamily: font.regular,
              fontSize: 14,
              lineHeight: 19,
              paddingVertical: 12,
              maxHeight: 140,
            }}
          />
          <IconButton
            label={t("mobile:composer.mentionSomeone")}
            onPress={() => setPicker(true)}
            size={36}
            style={{ marginBottom: 4 }}
          >
            <AtSign size={18} color={c.muted} strokeWidth={2} />
          </IconButton>
          <IconButton
            label={t("mobile:composer.attachImage")}
            onPress={attach}
            size={36}
            disabled={uploading}
            style={{ marginBottom: 4 }}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={c.muted} />
            ) : (
              <ImageIcon size={18} color={c.muted} strokeWidth={2} />
            )}
          </IconButton>
        </View>
        <Touch
          onPress={send}
          disabled={!text.trim() || busy}
          accessibilityLabel={t("mobile:composer.sendComment")}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: text.trim() ? c.primary : c.fill,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={c.onPrimary} />
          ) : (
            <ArrowUp
              size={18}
              color={text.trim() ? c.onPrimary : c.placeholder}
              strokeWidth={2}
            />
          )}
        </Touch>
      </View>
      <OptionSheet
        visible={picker}
        onClose={() => setPicker(false)}
        title={t("mobile:composer.mention")}
        searchable
        searchPlaceholder={t("mobile:composer.searchPeople")}
        options={members.map((m) => ({
          value: m.id,
          label: m.name,
          hint: m.email,
          leading: <Avatar name={m.name} image={m.image} size={28} />,
        }))}
        onSelect={(id) => {
          const m = members.find((x) => x.id === id);
          if (!m) return;
          setMentions((cur) => ({ ...cur, [m.name]: m.id }));
          setText((t) => `${t && !/\s$/.test(t) ? `${t} ` : t}@${m.name} `);
        }}
      />
    </View>
  );
}
