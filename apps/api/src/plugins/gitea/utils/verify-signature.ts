import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyGiteaSignature(
  payload: string,
  secret: string,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  let provided = signatureHeader.trim();
  if (provided.toLowerCase().startsWith("sha256=")) {
    provided = provided.slice(7);
  }

  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  try {
    const a = Buffer.from(provided, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return provided === expected;
  }
}
