import { isJsonObject } from "./is-json-object";

export function decodeJwtSegment(token: string, index: 0 | 1) {
  const segment = token.split(".")[index];
  if (!segment) return null;
  try {
    const value: unknown = JSON.parse(
      Buffer.from(segment, "base64url").toString("utf8"),
    );
    return isJsonObject(value) ? value : null;
  } catch {
    return null;
  }
}
