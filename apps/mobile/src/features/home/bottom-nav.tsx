import { Activity, CircleCheck, House, Inbox } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { useBottomInset } from "@/components/screen";
import { Txt } from "@/components/text";
import { CountBadge, Touch } from "@/components/ui";
import { useColors } from "@/theme";

export type HomeTab = "home" | "tasks" | "inbox" | "activity";

/** Slim bar of outline icons: the active tab is ink, the rest gray. No pill indicator. */
export function BottomNav({
  tab,
  onChange,
  unread,
}: {
  tab: HomeTab;
  onChange: (t: HomeTab) => void;
  unread: number;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const bottom = useBottomInset(4);
  const items: { key: HomeTab; label: string }[] = [
    { key: "home", label: t("mobile:nav.home") },
    { key: "tasks", label: t("mobile:nav.tasks") },
    { key: "inbox", label: t("mobile:nav.inbox") },
    { key: "activity", label: t("mobile:nav.activity") },
  ];
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.hairline,
        paddingBottom: bottom,
      }}
    >
      <View style={{ flexDirection: "row", height: 60, paddingHorizontal: 8 }}>
        {items.map((item) => {
          const active = item.key === tab;
          const color = active ? c.ink : c.placeholder;
          return (
            <Touch
              key={item.key}
              onPress={() => onChange(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={
                item.key === "inbox" && unread
                  ? t("mobile:nav.inboxUnread", { count: unread })
                  : item.label
              }
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <View>
                {item.key === "home" ? (
                  <House size={22} color={color} strokeWidth={2} />
                ) : item.key === "tasks" ? (
                  <CircleCheck size={22} color={color} strokeWidth={2} />
                ) : item.key === "inbox" ? (
                  <Inbox size={22} color={color} strokeWidth={2} />
                ) : (
                  <Activity size={22} color={color} strokeWidth={2} />
                )}
                {item.key === "inbox" && unread > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -6,
                      left: 12,
                      borderWidth: 2,
                      borderColor: c.surface,
                      borderRadius: 999,
                    }}
                  >
                    <CountBadge count={unread} tone="info" />
                  </View>
                ) : null}
              </View>
              <Txt
                variant="micro"
                weight="medium"
                color={active ? c.ink : c.faint}
              >
                {item.label}
              </Txt>
            </Touch>
          );
        })}
      </View>
    </View>
  );
}
