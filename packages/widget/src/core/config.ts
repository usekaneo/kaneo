import * as z from "zod/mini";
import { SDK_VERSION } from "../version.js";

/** Unknown config fields are ignored; malformed known fields fail closed. */
export const serverConfigSchema = z.object({
  theme: z.optional(
    z.object({
      lightPrimary: z.optional(z.string()),
      lightPrimaryForeground: z.optional(z.string()),
      darkPrimary: z.optional(z.string()),
      darkPrimaryForeground: z.optional(z.string()),
      themeMode: z.optional(z.enum(["light", "dark", "user"])),
    }),
  ),
  tabs: z.optional(
    z.object({
      feedback: z.optional(z.boolean()),
      changelog: z.optional(z.boolean()),
      help: z.optional(z.boolean()),
      chat: z.optional(z.boolean()),
      tickets: z.optional(z.boolean()),
    }),
  ),
  imageUploadsInWidget: z.optional(z.boolean()),
  hmacRequired: z.optional(z.boolean()),
  visitorAnalytics: z.optional(z.boolean()),
  visitorDeviceTracking: z.optional(z.boolean()),
  launcherGreeting: z.nullish(z.string()),
  launcherLabel: z.nullish(z.string()),
  position: z.optional(z.enum(["left", "right"])),
});
export type ServerConfig = z.infer<typeof serverConfigSchema>;

/** The version query keeps this cross-origin GET free of custom-header preflights. */
export async function fetchServerConfig(
  instanceUrl: string,
  signal?: AbortSignal,
): Promise<ServerConfig> {
  try {
    const url = `${instanceUrl}/api/widget/config.json?sdk=${encodeURIComponent(SDK_VERSION)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return {};
    const parsed = serverConfigSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}
