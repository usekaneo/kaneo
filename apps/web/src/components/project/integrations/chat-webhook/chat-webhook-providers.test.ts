import { describe, expect, it } from "vite-plus/test";
import {
  discordChatProvider,
  mattermostChatProvider,
  slackChatProvider,
} from "./chat-webhook-providers";
import { isValidChatWebhookUrl } from "./is-valid-chat-webhook-url";

describe("chat webhook providers", () => {
  it.each([
    {
      provider: slackChatProvider,
      valid: "https://hooks.slack.com/services/T000/B000/XXXX",
      invalid: "https://discord.com/api/webhooks/1/abc",
    },
    {
      provider: discordChatProvider,
      valid: "https://discord.com/api/webhooks/123/abc-DEF",
      invalid: "https://hooks.slack.com/services/T000/B000/XXXX",
    },
    {
      provider: mattermostChatProvider,
      valid: "https://chat.example.com/hooks/abc",
      invalid: "http://chat.example.com/hooks/abc",
    },
  ])(
    "validates $provider.name webhook URLs",
    ({ provider, valid, invalid }) => {
      expect(isValidChatWebhookUrl(valid, provider.webhookUrlPattern)).toBe(
        true,
      );
      expect(isValidChatWebhookUrl(invalid, provider.webhookUrlPattern)).toBe(
        false,
      );
    },
  );

  it("accepts the legacy discordapp.com host", () => {
    expect(
      isValidChatWebhookUrl(
        "https://discordapp.com/api/webhooks/123/abc",
        discordChatProvider.webhookUrlPattern,
      ),
    ).toBe(true);
  });

  it("only clears the Mattermost channel with null", () => {
    expect(slackChatProvider.emptyChannelName).toBeUndefined();
    expect(discordChatProvider.emptyChannelName).toBeUndefined();
    expect(mattermostChatProvider.emptyChannelName).toBeNull();
  });

  it("points every provider at its own copy", () => {
    for (const [provider, namespace] of [
      [slackChatProvider, "slackIntegration"],
      [discordChatProvider, "discordIntegration"],
      [mattermostChatProvider, "mattermostIntegration"],
    ] as const) {
      for (const key of Object.values(provider.keys)) {
        expect(key.startsWith(`settings:${namespace}.`)).toBe(true);
      }
    }
  });
});
