import { Check, Search } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { font, radius, useColors } from "@/theme";

import { Txt } from "./text";
import { Button, Checkbox, Touch } from "./ui";

/**
 * Bottom sheet: dimmed scrim, rounded top, grab handle. Every picker and form pop-up in the app
 * uses this instead of centered Material dialogs, so it stays reachable one-handed and sits above
 * the keyboard.
 */
export function Sheet({
  visible,
  onClose,
  title,
  aside,
  children,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [progress] = useState(() => new Animated.Value(0));
  // Mount as soon as the sheet is asked to show; unmount only after the close animation, so the
  // content (and any form state in it) starts fresh on every open.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      Animated.timing(progress, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => finished && setMounted(false));
    }
  }, [visible, progress]);

  if (!mounted) return null;
  const maxHeight = Dimensions.get("window").height * 0.88;
  const Body = scroll ? ScrollView : View;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Animated.View
        style={{ flex: 1, backgroundColor: c.scrim, opacity: progress }}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityLabel="Close"
        />
      </Animated.View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
        pointerEvents="box-none"
      >
        <Animated.View
          style={{
            maxHeight,
            backgroundColor: c.surface,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            paddingBottom: Math.max(insets.bottom, 12),
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [400, 0],
                }),
              },
            ],
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: -8 },
            elevation: 16,
          }}
        >
          <View
            style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: c.fillStrong,
              }}
            />
          </View>
          {title ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingTop: 8,
                paddingBottom: 12,
              }}
            >
              <Txt variant="h3" style={{ flex: 1 }}>
                {title}
              </Txt>
              {aside}
            </View>
          ) : null}
          <Body keyboardShouldPersistTaps="handled" bounces={false}>
            {children}
          </Body>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export type Option<T> = {
  value: T;
  label: string;
  hint?: string | null;
  leading?: ReactNode;
  tone?: "danger";
};

/** Single-choice list in a sheet: assignee, status, priority, project. */
export function OptionSheet<T>({
  visible,
  onClose,
  title,
  options,
  selected,
  onSelect,
  searchable,
  searchPlaceholder = "Search",
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: Option<T>[];
  selected?: T;
  onSelect: (value: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <OptionList
        options={options}
        selected={selected}
        onSelect={onSelect}
        onClose={onClose}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
      />
    </Sheet>
  );
}

function OptionList<T>({
  options,
  selected,
  onSelect,
  onClose,
  searchable,
  searchPlaceholder,
}: {
  options: Option<T>[];
  selected?: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  searchable?: boolean;
  searchPlaceholder: string;
}) {
  const c = useColors();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.hint ?? "").toLowerCase().includes(q),
      )
    : options;
  return (
    <>
      {searchable ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
          />
        </View>
      ) : null}
      <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
        {shown.map((o) => {
          const active = selected !== undefined && o.value === selected;
          return (
            <Touch
              key={String(o.value)}
              onPress={() => {
                onSelect(o.value);
                onClose();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                minHeight: o.hint ? 56 : 48,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: active ? c.fill : "transparent",
              }}
            >
              {o.leading}
              <View style={{ flex: 1 }}>
                <Txt
                  variant="body"
                  weight={active ? "medium" : "regular"}
                  tone={o.tone === "danger" ? "danger" : "ink"}
                >
                  {o.label}
                </Txt>
                {o.hint ? (
                  <Txt variant="caption" tone="faint">
                    {o.hint}
                  </Txt>
                ) : null}
              </View>
              {active ? (
                <Check size={18} color={c.ink} strokeWidth={2.5} />
              ) : null}
            </Touch>
          );
        })}
        {shown.length === 0 ? (
          <Txt variant="meta" tone="faint" style={{ padding: 12 }}>
            Nothing matches “{query}”
          </Txt>
        ) : null}
      </View>
    </>
  );
}

export function MultiSelectSheet({
  visible,
  onClose,
  title,
  options,
  selected,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: string[];
  selected: string[];
  onSave: (values: string[]) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <MultiSelectBody
        options={options}
        selected={selected}
        onSave={onSave}
        onClose={onClose}
      />
    </Sheet>
  );
}

function MultiSelectBody({
  options,
  selected,
  onSave,
  onClose,
}: {
  options: string[];
  selected: string[];
  onSave: (values: string[]) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<string[]>(selected);
  const toggle = (v: string) =>
    setChosen((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );
  return (
    <>
      <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
        {options.map((o) => (
          <Touch
            key={o}
            onPress={() => toggle(o)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              height: 48,
              paddingHorizontal: 12,
            }}
          >
            <Checkbox checked={chosen.includes(o)} onPress={() => toggle(o)} />
            <Txt variant="body">{o}</Txt>
          </Touch>
        ))}
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <Button
          label="Save"
          onPress={() => {
            onSave(chosen);
            onClose();
          }}
        />
      </View>
    </>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        height: 44,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: c.input,
      }}
    >
      <Search size={16} color={c.faint} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.placeholder}
        autoFocus={autoFocus}
        autoCorrect={false}
        selectionColor={c.ink}
        style={{
          flex: 1,
          color: c.ink,
          fontFamily: font.regular,
          fontSize: 15,
          height: 44,
        }}
      />
    </View>
  );
}

/** Small centered alert, only for destructive confirmations. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  destructive = true,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const c = useColors();
  if (!visible) return null;
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "#00000066",
          justifyContent: "center",
          padding: 28,
        }}
      >
        <Pressable
          style={{
            backgroundColor: c.surface,
            borderRadius: 16,
            paddingTop: 22,
            paddingHorizontal: 20,
            paddingBottom: 16,
            gap: 6,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 16 },
            elevation: 12,
          }}
        >
          <Txt variant="h3">{title}</Txt>
          {message ? (
            <Txt variant="bodySm" tone="muted" style={{ lineHeight: 20 }}>
              {message}
            </Txt>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8, paddingTop: 14 }}>
            <Button
              label="Cancel"
              kind="secondary"
              size="md"
              grow
              onPress={onClose}
            />
            <Button
              label={confirmLabel}
              kind={destructive ? "danger" : "primary"}
              size="md"
              grow
              onPress={() => {
                onClose();
                onConfirm();
              }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
