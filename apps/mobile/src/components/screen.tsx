import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft, X } from "lucide-react-native";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { inset, useColors, useIsDark } from "@/theme";

import { Txt } from "./text";
import { Button, IconButton } from "./ui";

/** Page container: paints the ground color and keeps content below the status bar. */
export function Screen({
  children,
  surface,
  style,
}: {
  children: ReactNode;
  /** White background instead of the light gray ground (detail and form screens). */
  surface?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          flex: 1,
          paddingTop: insets.top,
          backgroundColor: surface ? c.surface : c.ground,
        },
        style,
      ]}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      {children}
    </View>
  );
}

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export function BackButton({
  close,
  onPress,
}: {
  close?: boolean;
  onPress?: () => void;
}) {
  const c = useColors();
  return (
    <IconButton
      label={close ? "Close" : "Back"}
      onPress={onPress ?? goBack}
      size={40}
    >
      {close ? (
        <X size={20} color={c.ink} strokeWidth={2} />
      ) : (
        <ChevronLeft size={22} color={c.ink} strokeWidth={2} />
      )}
    </IconButton>
  );
}

/** Settings-style header: back arrow, large title and a one-line description, like the web settings pages. */
export function PageHeader({
  title,
  description,
  action,
  back = true,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  back?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: inset,
        paddingTop: 4,
        paddingBottom: 20,
        gap: 6,
      }}
    >
      {back || action ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            height: 40,
            marginLeft: -10,
          }}
        >
          {back ? <BackButton /> : <View />}
          {action}
        </View>
      ) : null}
      <Txt variant="title">{title}</Txt>
      {description ? (
        <Txt variant="bodySm" tone="muted" style={{ lineHeight: 20 }}>
          {description}
        </Txt>
      ) : null}
    </View>
  );
}

/** Thin top bar for detail screens: back, a title area, actions. */
export function TopBar({
  children,
  actions,
  close,
  border = true,
}: {
  children?: ReactNode;
  actions?: ReactNode;
  close?: boolean;
  border?: boolean;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        height: 52,
        paddingLeft: 6,
        paddingRight: 8,
        borderBottomWidth: border ? 1 : 0,
        borderBottomColor: c.divider,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}
      >
        <BackButton close={close} />
        {children}
      </View>
      {actions ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {actions}
        </View>
      ) : null}
    </View>
  );
}

export function Scroll({
  children,
  refreshing,
  onRefresh,
  bottomPadding = 32,
  ...rest
}: ScrollViewProps & {
  refreshing?: boolean;
  onRefresh?: () => void;
  bottomPadding?: number;
}) {
  const c = useColors();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={c.muted}
            colors={[c.ink]}
          />
        ) : undefined
      }
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

export function Loading({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View
      style={[
        {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        },
        style,
      ]}
    >
      <ActivityIndicator color={c.muted} />
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
  style,
}: {
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          alignItems: "center",
          paddingHorizontal: 32,
          paddingVertical: 48,
          gap: 8,
        },
        style,
      ]}
    >
      <Txt variant="section" center>
        {title}
      </Txt>
      {message ? (
        <Txt variant="bodySm" tone="muted" center style={{ lineHeight: 20 }}>
          {message}
        </Txt>
      ) : null}
      {action ? (
        <Button
          label={action.label}
          kind="secondary"
          size="md"
          onPress={action.onPress}
          style={{ marginTop: 8 }}
        />
      ) : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      title="Couldn't load this"
      message={message}
      action={onRetry ? { label: "Try again", onPress: onRetry } : undefined}
    />
  );
}

/** Gesture-bar-aware bottom padding for docked bars. */
export function useBottomInset(min = 8) {
  return Math.max(useSafeAreaInsets().bottom, min);
}
