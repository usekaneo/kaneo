import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { postToDiscord } from "../../../apps/api/src/plugins/discord/client";
import { postToSlack } from "../../../apps/api/src/plugins/slack/client";
import { isSensitiveOutboundRequest } from "../../../apps/api/src/utils/sensitive-outbound";

afterEach(() => vi.unstubAllGlobals());

const clients = [
  {
    name: "Discord",
    send: (url: string) => postToDiscord(url, { content: "message" }),
    payload: { content: "message" },
  },
  {
    name: "Slack",
    send: (url: string) => postToSlack(url, { text: "message" }),
    payload: { text: "message" },
  },
];

describe.each(clients)(
  "$name credential-bearing delivery",
  ({ send, payload }) => {
    it("sends JSON with telemetry excluded and redirects disabled", async () => {
      const response = new Response("{}", { status: 200 });
      const cancel = vi.spyOn(response.body!, "cancel");
      const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
        expect(isSensitiveOutboundRequest()).toBe(true);
        expect(init).toMatchObject({
          method: "POST",
          redirect: "manual",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        return response;
      });
      vi.stubGlobal("fetch", fetch);
      await send("https://service.example/webhooks/SECRET");
      expect(fetch).toHaveBeenCalledOnce();
      expect(cancel).toHaveBeenCalledOnce();
      expect(isSensitiveOutboundRequest()).toBe(false);
    });

    it.each([302, 503])(
      "omits upstream response text for HTTP %s",
      async (status) => {
        const response = new Response("UPSTREAM_SECRET", { status });
        const read = vi.spyOn(response, "text");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
        await expect(
          send("https://service.example/webhooks/SECRET"),
        ).rejects.toThrow(`Outbound request failed: http (HTTP ${status})`);
        expect(read).not.toHaveBeenCalled();
      },
    );

    it("discards secret-bearing network errors and their causes", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(
          new Error("https://service.example/webhooks/SECRET", {
            cause: new Error("CAUSE_SECRET"),
          }),
        ),
      );
      const error = await send("https://service.example/webhooks/SECRET").catch(
        (failure: unknown) => failure,
      );
      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty(
        "message",
        "Outbound request failed: network",
      );
      expect(error).not.toHaveProperty("cause");
      expect(String(error)).not.toContain("SECRET");
    });
  },
);
