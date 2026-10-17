import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  useFonts,
} from "@expo-google-fonts/geist";
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
} from "@expo-google-fonts/geist-mono";
import { QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { NotificationOpener } from "@/components/notification-opener";
import { ToastProvider, useToast } from "@/components/toast";
import { onSessionExpired } from "@/lib/api/client";
import { signOut } from "@/lib/auth";
import {
  requestNotificationPermission,
  setBackgroundChecks,
} from "@/lib/background";
import { loadDeviceLocale } from "@/lib/i18n";
import { queryClient } from "@/lib/query";
import { sessionStore, useSessionState } from "@/lib/session";
import { useColors } from "@/theme";

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });
  const { ready } = useSessionState();
  const [localeLoaded, setLocaleLoaded] = useState(false);

  useEffect(() => {
    void sessionStore.hydrate();
    void loadDeviceLocale().finally(() => setLocaleLoaded(true));
  }, []);

  const loaded = fontsLoaded && ready && localeLoaded;
  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AppStack />
          </ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppStack() {
  const c = useColors();
  const { session, prefs } = useSessionState();
  const toast = useToast();
  const { t } = useTranslation(["mobile"]);
  const signedIn = !!session;

  // A 401 on a signed-in request means the session was revoked elsewhere.
  useEffect(
    () =>
      onSessionExpired(() => {
        toast.show(t("mobile:errors.sessionExpired"), "error");
        queryClient.clear();
        void signOut();
      }),
    [toast, t],
  );

  useEffect(() => {
    if (!signedIn) {
      queryClient.clear();
      void setBackgroundChecks(false);
      return;
    }
    if (prefs.backgroundNotifications) {
      void requestNotificationPermission().then(() =>
        setBackgroundChecks(true),
      );
    }
  }, [signedIn, prefs.backgroundNotifications]);

  return (
    <>
      <NotificationOpener enabled={signedIn} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.ground },
          animation: "slide_from_right",
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
