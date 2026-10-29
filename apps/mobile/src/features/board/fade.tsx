import { View } from "react-native";

/** Soft fade above the docked toolbar so cards dissolve into the ground instead of cutting off. */
export function LinearGradientFallback({
  color,
  height = 28,
}: {
  color: string;
  height?: number;
}) {
  const steps = 7;
  return (
    <View pointerEvents="none" style={{ height }}>
      {Array.from({ length: steps }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            backgroundColor: color,
            opacity: (i + 1) / (steps + 1),
          }}
        />
      ))}
    </View>
  );
}
