import { Activity, House, Inbox } from "lucide-react-native";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { useBottomInset } from "@/components/screen";
import { Txt } from "@/components/text";
import { CountBadge, Touch } from "@/components/ui";
import { useColors } from "@/theme";

export type HomeTab = "home" | "tasks" | "inbox" | "activity";

function TasksIcon({
  active,
  color,
  ink,
  check,
}: {
  active: boolean;
  color: string;
  ink: string;
  check: string;
}) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Circle
        cx={12}
        cy={12}
        r={9}
        fill={active ? ink : "none"}
        stroke={active ? ink : color}
        strokeWidth={2}
      />
      <Path
        d="m8.5 12 2.5 2.5 4.5-5"
        fill="none"
        stroke={active ? check : color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Slim ink-on-white bar: the active tab is ink with a filled icon, the rest gray. No pill indicator. */
export function BottomNav({
  tab,
  onChange,
  unread,
}: {
  tab: HomeTab;
  onChange: (t: HomeTab) => void;
  unread: number;
}) {
  const c = useColors();
  const bottom = useBottomInset(4);
  const items: { key: HomeTab; label: string }[] = [
    { key: "home", label: "Home" },
    { key: "tasks", label: "My tasks" },
    { key: "inbox", label: "Inbox" },
    { key: "activity", label: "Activity" },
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
          const color = active ? c.ink : c.faint;
          return (
            <Touch
              key={item.key}
              onPress={() => onChange(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={
                item.key === "inbox" && unread
                  ? `Inbox, ${unread} unread`
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
                  <House
                    size={20}
                    color={color}
                    fill={active ? c.ink : "none"}
                    strokeWidth={active ? 1.5 : 2}
                  />
                ) : item.key === "tasks" ? (
                  <TasksIcon
                    active={active}
                    color={color}
                    ink={c.ink}
                    check={c.surface}
                  />
                ) : item.key === "inbox" ? (
                  <Inbox
                    size={20}
                    color={color}
                    strokeWidth={2}
                    fill={active ? c.fill : "none"}
                  />
                ) : (
                  <Activity
                    size={20}
                    color={color}
                    strokeWidth={active ? 2.5 : 2}
                  />
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
                    <CountBadge count={unread} />
                  </View>
                ) : null}
              </View>
              <Txt
                variant="micro"
                weight={active ? "semibold" : "medium"}
                color={color}
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
