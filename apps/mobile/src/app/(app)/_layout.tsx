import { Stack } from "expo-router";

import { useColors } from "@/theme";

export default function SignedInLayout() {
  const c = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.ground },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="task/new"
        options={{ animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="workspace/new"
        options={{ animation: "slide_from_bottom" }}
      />
    </Stack>
  );
}
