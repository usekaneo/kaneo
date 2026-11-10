import { brand } from "@kaneo/branding";
import { Text } from "react-native";
import { useIsDark } from "@/theme";

export function KaneoLogo({ height = 32 }: { height?: number }) {
  const color = useIsDark() ? "#F5F5F5" : "#141414";
  return (
    <Text
      accessibilityLabel={brand.name}
      style={{ color, fontSize: height, fontWeight: "600" }}
    >
      {brand.name}
    </Text>
  );
}

export function KaneoMark({ size = 24 }: { size?: number }) {
  const color = useIsDark() ? "#F5F5F5" : "#141414";
  return (
    <Text
      accessibilityLabel={brand.name}
      style={{ color, fontSize: size, fontWeight: "600" }}
    >
      {brand.name.slice(0, 1)}
    </Text>
  );
}
