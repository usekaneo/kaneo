import { CircleAlert, CircleCheck } from "lucide-react-native";
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
              gap: 10,
              minHeight: 48,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: c.toast,
              borderWidth: 1,
              borderColor: c.hairline,
              boxShadow: c.overlay,
            }}
          >
            {toast.kind === "success" ? (
              <CircleCheck size={18} color={c.successFg} strokeWidth={2} />
            ) : toast.kind === "error" ? (
              <CircleAlert size={18} color={c.dangerRing} strokeWidth={2} />
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
