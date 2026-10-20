import { CircleAlert } from "lucide-react-native";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { useColors } from "@/theme";

import { Txt } from "./text";

type Kind = "success" | "error" | "info";
type ToastApi = { show: (message: string, kind?: Kind) => void };

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

/** One toast at a time, above the bottom bar; replaces Material snackbars. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{
    message: string;
    kind: Kind;
    key: number;
  } | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, kind: Kind = "info") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, kind, key: Date.now() });
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(
        () => {
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => setToast(null));
        },
        kind === "error" ? 4000 : 2600,
      );
    },
    [opacity],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: insets.bottom + 84,
            opacity,
            transform: [
              {
                translateY: opacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
            ],
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 48,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: c.toast,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
              elevation: 6,
            }}
          >
            {toast.kind === "success" ? (
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Circle cx={12} cy={12} r={10} fill="#10B981" />
                <Path
                  d="m8 12 3 3 5-6"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            ) : toast.kind === "error" ? (
              <CircleAlert size={16} color="#F87171" strokeWidth={2} />
            ) : null}
            <Txt variant="bodySm" color={c.onToast} style={{ flex: 1 }}>
              {toast.message}
            </Txt>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}
