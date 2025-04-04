import { encodeBase32LowerCaseNoPadding } from "@oslojs/encoding";

function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const token = encodeBase32LowerCaseNoPadding(bytes);
  return token;
}

export default generateSessionToken;
