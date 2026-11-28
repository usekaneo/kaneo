import { expect, it } from "vite-plus/test";
import { maskWebhookUrl } from "./mask-webhook-url";

it.each([
  [
    "keeps the origin and non-secret path segments",
    "https://hooks.example.com:8443/services/team/channel/abcdefgh1234",
    "https://hooks.example.com:8443/services/team/channel/abcd…1234",
  ],
  [
    "drops credentials, query strings, and fragments",
    "https://user:password@hooks.example.com/hooks/abcdefgh1234?token=query#secret",
    "https://hooks.example.com/hooks/abcd…1234",
  ],
  [
    "masks an eight-character token in full",
    "https://hooks.example.com/hooks/abcdefgh/",
    "https://hooks.example.com/hooks/••••",
  ],
  [
    "preserves the display format for a single path segment",
    "https://hooks.example.com/abcdefgh1234",
    "https://hooks.example.com//abcd…1234",
  ],
  ["uses the fallback for malformed input", "not a URL", "Configured"],
  ["uses the fallback for an empty string", "", "Configured"],
])("%s", (_description, url, expected) => {
  expect(maskWebhookUrl(url)).toBe(expected);
});
