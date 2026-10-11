import { Image } from "expo-image";
import { View } from "react-native";

import { resolveUrl } from "@/lib/api/client";
import { initials } from "@/lib/format";
import { useSession } from "@/lib/session";
import { avatarTint, font, useColors, useIsDark } from "@/theme";

import { Txt } from "./text";

export function Avatar({
  name,
  image,
  size = 22,
}: {
  name?: string | null;
  image?: string | null;
  size?: number;
}) {
  const isDark = useIsDark();
  const session = useSession();
  const tint = avatarTint(name ?? "?", isDark);
  const uri = session ? resolveUrl(session.serverUrl, image) : null;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tint.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt
        style={{
          fontFamily: font.semibold,
          fontSize: Math.max(8, Math.round(size * 0.38)),
          lineHeight: size,
        }}
        color={tint.fg}
      >
        {initials(name)}
      </Txt>
    </View>
  );
}

/** Dashed empty circle used for "Unassigned". */
export function EmptyAvatar({ size = 22 }: { size?: number }) {
  const c = useColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: c.fillStrong,
      }}
    />
  );
}

/** Overlapping row of avatars, e.g. people active on a board. */
export function AvatarStack({
  people,
  size = 24,
}: {
  people: { id: string; name: string; image?: string | null }[];
  size?: number;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row" }}>
      {people.slice(0, 4).map((p, i) => (
        <View
          key={p.id}
          style={{
            marginLeft: i === 0 ? 0 : -6,
            borderRadius: size,
            borderWidth: 2,
            borderColor: c.ground,
          }}
        >
          <Avatar name={p.name} image={p.image} size={size - 4} />
        </View>
      ))}
    </View>
  );
}
