import { describe, expect, it } from "vite-plus/test";
import { buildChatWebhookRequest } from "./build-chat-webhook-request";
import { toChatEvents } from "./chat-events";

const slack = {
  webhookUrlPattern: /^https:\/\/hooks\.slack\.com\/services\/\w+\/\w+\/\w+$/,
  emptyChannelName: undefined,
};
const mattermost = {
  webhookUrlPattern: /^https:\/\/.+/,
  emptyChannelName: null,
};
const slackUrl = "https://hooks.slack.com/services/T000/B000/XXXX";
const events = toChatEvents();

describe("buildChatWebhookRequest", () => {
  it("requires a valid webhook URL before connecting", () => {
    expect(
      buildChatWebhookRequest(
        { webhookUrl: "", channelName: "", events },
        false,
        slack,
      ),
    ).toEqual({ kind: "invalid" });
    expect(
      buildChatWebhookRequest(
        { webhookUrl: "https://example.com/hook", channelName: "", events },
        false,
        slack,
      ),
    ).toEqual({ kind: "invalid" });
  });

  it("creates with trimmed values and drops an empty channel", () => {
    expect(
      buildChatWebhookRequest(
        { webhookUrl: `  ${slackUrl} `, channelName: "  ", events },
        false,
        slack,
      ),
    ).toEqual({
      kind: "create",
      data: { webhookUrl: slackUrl, channelName: undefined, events },
    });
  });

  it("keeps the saved URL when the field is left empty", () => {
    expect(
      buildChatWebhookRequest(
        { webhookUrl: "", channelName: "#launch", events },
        true,
        slack,
      ),
    ).toEqual({
      kind: "update",
      json: { webhookUrl: undefined, channelName: "#launch", events },
    });
  });

  it("rejects a replacement URL that does not match the provider", () => {
    expect(
      buildChatWebhookRequest(
        { webhookUrl: "https://example.com/hook", channelName: "", events },
        true,
        slack,
      ),
    ).toEqual({ kind: "invalid" });
  });

  it("uses the provider value for a cleared channel", () => {
    const values = { webhookUrl: "", channelName: "", events };

    expect(buildChatWebhookRequest(values, true, slack)).toMatchObject({
      json: { channelName: undefined },
    });
    expect(buildChatWebhookRequest(values, true, mattermost)).toMatchObject({
      json: { channelName: null },
    });
  });
});
