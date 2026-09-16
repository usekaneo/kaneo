import { getApiUrl } from "@/fetchers/get-api-url";

export function resolveAvatarSrc(src: string | undefined) {
  if (!src?.startsWith("/api/")) return src;
  return getApiUrl(src.slice("/api/".length));
}

export default resolveAvatarSrc;
