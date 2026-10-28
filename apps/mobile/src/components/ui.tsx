import { forwardRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { labelColor } from "@/lib/style";
import { font, inset, radius, useColors } from "@/theme";

import { Txt } from "./text";

/** Pressable that dims slightly while pressed; the app's one touch feedback. */
export function Touch({
  style,
  children,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        style,
        pressed && !rest.disabled ? { opacity: 0.6 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

type ButtonKind =
  | "primary"
  | "secondary"
  | "danger"
  | "dangerOutline"
  | "ghost";

export function Button({
  label,
  onPress,
  kind = "primary",
  disabled,
  loading,
  icon,
  size = "lg",
  style,
  grow,
}: {
  label: string;
  onPress?: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  size?: "lg" | "md" | "sm";
  style?: StyleProp<ViewStyle>;
  grow?: boolean;
}) {
  const c = useColors();
  const height = size === "lg" ? 48 : size === "md" ? 40 : 32;
  const inactive = disabled || loading;
  const bg =
    kind === "primary"
      ? inactive
        ? c.fill
        : c.primary
      : kind === "danger"
        ? c.dangerRing
        : kind === "secondary" || kind === "dangerOutline"
          ? c.surface
          : "transparent";
  const fg =
    kind === "primary"
      ? inactive
        ? c.placeholder
        : c.onPrimary
      : kind === "danger"
        ? "#FFFFFF"
        : kind === "dangerOutline"
          ? c.danger
          : c.ink;
  const border =
    kind === "secondary"
      ? c.fillStrong
      : kind === "dangerOutline"
        ? c.dangerBorder
        : "transparent";
  return (
    <Touch
      onPress={onPress}
      disabled={inactive}
      style={[
        {
          height,
          borderRadius: size === "sm" ? 8 : size === "md" ? 10 : radius.lg,
          backgroundColor: bg,
          borderWidth: border === "transparent" ? 0 : 1,
          borderColor: border,
          paddingHorizontal: size === "sm" ? 12 : 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        },
        grow ? { flex: 1 } : null,
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon}
      <Txt variant={size === "sm" ? "meta" : "body"} weight="medium" color={fg}>
        {label}
      </Txt>
    </Touch>
  );
}

export function IconButton({
  children,
  onPress,
  size = 36,
  label,
  style,
  disabled,
}: {
  children: ReactNode;
  onPress?: () => void;
  size?: number;
  label: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  return (
    <Touch
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={6}
      style={[
        {
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
        },
        style,
      ]}
    >
      {children}
    </Touch>
  );
}

/** White grouped card with a hairline border; rows inside are separated by dividers. */
export function Group({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.hairline,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ height: 1, backgroundColor: c.divider }, style]} />;
}

/** A row in a Group. Pass `last` to drop its bottom divider. */
export function GroupRow({
  children,
  onPress,
  last,
  style,
  disabled,
}: {
  children: ReactNode;
  onPress?: () => void;
  last?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const c = useColors();
  const content = [
    {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      paddingHorizontal: 14,
      minHeight: 48,
      paddingVertical: 10,
    },
    !last ? { borderBottomWidth: 1, borderBottomColor: c.divider } : null,
    style,
  ];
  if (!onPress) return <View style={content}>{children}</View>;
  return (
    <Touch onPress={onPress} disabled={disabled} style={content}>
      {children}
    </Touch>
  );
}

export function Section({
  title,
  aside,
  children,
  style,
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ paddingHorizontal: inset, gap: 8 }, style]}>
      {title ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 2,
            minHeight: 20,
          }}
        >
          <Txt variant="bodySm" weight="semibold">
            {title}
          </Txt>
          {aside}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function LabelDot({
  color,
  size = 6,
}: {
  color: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: labelColor(color),
      }}
    />
  );
}

/** "● Bug" — the web's label treatment: a colored dot and the name, no pill fill. */
export function LabelTag({
  name,
  color,
  size = "sm",
}: {
  name: string;
  color: string;
  size?: "sm" | "md";
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <LabelDot color={color} />
      <Txt variant={size === "md" ? "meta" : "caption"} weight="medium">
        {name}
      </Txt>
    </View>
  );
}

/** Selectable chip used in filters and pickers. Selected chips are filled with ink. */
export function Chip({
  label,
  selected,
  onPress,
  leading,
  dashed,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  leading?: ReactNode;
  dashed?: boolean;
}) {
  const c = useColors();
  return (
    <Touch
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 32,
        paddingHorizontal: 10,
        paddingLeft: leading ? 8 : 10,
        borderRadius: 8,
        backgroundColor: selected ? c.primary : c.surface,
        borderWidth: selected ? 0 : 1,
        borderStyle: dashed ? "dashed" : "solid",
        borderColor: dashed ? c.fillStrong : c.hairline,
      }}
    >
      {leading}
      <Txt
        variant="meta"
        weight="medium"
        color={selected ? c.onPrimary : dashed ? c.muted : c.ink}
      >
        {label}
      </Txt>
    </Touch>
  );
}

export function Switch({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <Touch
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      hitSlop={8}
      style={{
        width: 40,
        height: 24,
        borderRadius: 999,
        padding: 2,
        justifyContent: "center",
        alignItems: value ? "flex-end" : "flex-start",
        backgroundColor: value ? c.primary : c.fillStrong,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: value ? c.onPrimary : "#FFFFFF",
        }}
      />
    </Touch>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: {
    value: T;
    label: string;
    count?: number;
    icon?: (active: boolean) => ReactNode;
  }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          padding: 3,
          gap: 2,
          borderRadius: 10,
          backgroundColor: c.fill,
        },
        style,
      ]}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Touch
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: o.icon && !o.label ? undefined : 1,
              height: 32,
              minWidth: 32,
              paddingHorizontal: 8,
              borderRadius: 7,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
              backgroundColor: active ? c.card : "transparent",
              ...(active
                ? {
                    shadowColor: "#000",
                    shadowOpacity: 0.08,
                    shadowRadius: 2,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 1,
                  }
                : null),
            }}
          >
            {o.icon?.(active)}
            {o.label ? (
              <Txt
                variant="meta"
                weight="medium"
                tone={active ? "ink" : "muted"}
              >
                {o.label}
              </Txt>
            ) : null}
            {o.count !== undefined ? (
              <Txt variant="caption" tone="faint">
                {o.count}
              </Txt>
            ) : null}
          </Touch>
        );
      })}
    </View>
  );
}

export const TextField = forwardRef<
  TextInputInstance,
  TextInputProps & {
    label?: string;
    hint?: string;
    aside?: string;
    mono?: boolean;
    leading?: ReactNode;
    trailing?: ReactNode;
    error?: string | null;
  }
>(function TextField(
  {
    label,
    hint,
    aside,
    mono,
    leading,
    trailing,
    error,
    style,
    multiline,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      {label || aside ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {label ? (
            <Txt variant="meta" weight="medium" tone="body">
              {label}
            </Txt>
          ) : (
            <View />
          )}
          {aside ? (
            <Txt variant="caption" tone="faint">
              {aside}
            </Txt>
          ) : null}
        </View>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: multiline ? "flex-start" : "center",
          gap: 10,
          minHeight: 46,
          paddingHorizontal: 14,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: error ? c.dangerRing : c.fillStrong,
          backgroundColor: c.surface,
        }}
      >
        {leading}
        <TextInput
          ref={ref}
          placeholderTextColor={c.placeholder}
          selectionColor={c.ink}
          cursorColor={c.ink}
          multiline={multiline}
          {...rest}
          style={[
            {
              flex: 1,
              color: c.ink,
              fontFamily: mono ? font.mono : font.regular,
              fontSize: mono ? 14 : 15,
              paddingVertical: multiline ? 12 : 0,
              minHeight: multiline ? 84 : 44,
              textAlignVertical: multiline ? "top" : "center",
            },
            style,
          ]}
        />
        {trailing}
      </View>
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="caption" tone="faint" style={{ lineHeight: 17 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
});

export function CountBadge({
  count,
  inverse,
}: {
  count: number;
  inverse?: boolean;
}) {
  const c = useColors();
  return (
    <View
      style={{
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: inverse ? c.onPrimary : c.primary,
      }}
    >
      <Txt
        style={{ fontFamily: font.semibold, fontSize: 10, lineHeight: 12 }}
        color={inverse ? c.primary : c.onPrimary}
      >
        {count > 99 ? "99+" : count}
      </Txt>
    </View>
  );
}

export function Checkbox({
  checked,
  onPress,
}: {
  checked: boolean;
  onPress?: () => void;
}) {
  const c = useColors();
  return (
    <Touch
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{
        width: 18,
        height: 18,
        borderRadius: 5,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: checked ? c.primary : "transparent",
        borderWidth: checked ? 0 : 1.5,
        borderColor: c.placeholder,
      }}
    >
      {checked ? <CheckGlyph color={c.onPrimary} /> : null}
    </Touch>
  );
}

export function CheckGlyph({
  color,
  size = 12,
}: {
  color: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="m5 12 5 5 9-10"
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Radio({ selected }: { selected: boolean }) {
  const c = useColors();
  return (
    <View
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: selected ? 5 : 1.5,
        borderColor: selected ? c.primary : c.placeholder,
      }}
    />
  );
}

export function ProgressBar({ value }: { value: number }) {
  const c = useColors();
  return (
    <View
      style={{
        flex: 1,
        height: 4,
        borderRadius: 999,
        backgroundColor: c.fill,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: 4,
          borderRadius: 999,
          backgroundColor: c.ink,
        }}
      />
    </View>
  );
}
