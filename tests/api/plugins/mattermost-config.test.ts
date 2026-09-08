import { afterEach, describe, expect, it } from "vitest";
import { validateMattermostConfig } from "../../../apps/api/src/plugins/mattermost/config";

const originalAllowPrivateDestinations =
  process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;

afterEach(() => {
  if (originalAllowPrivateDestinations === undefined) {
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;
  } else {
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS =
      originalAllowPrivateDestinations;
  }
});

describe("validateMattermostConfig", () => {
  it("rejects private webhook destinations by default", async () => {
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;

    const result = await validateMattermostConfig({
      webhookUrl: "https://127.0.0.1/hooks/example",
    });

    expect(result.valid).toBe(false);
    expect(result.errors?.join(" ")).toContain("non-routable address");
  });

  it("allows private destinations when the self-hosting override is enabled", async () => {
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = "true";

    const result = await validateMattermostConfig({
      webhookUrl: "https://127.0.0.1/hooks/example",
    });

    expect(result).toEqual({ valid: true });
  });

  it("rejects an explicitly empty webhook URL", async () => {
    const result = await validateMattermostConfig({ webhookUrl: "" });

    expect(result.valid).toBe(false);
  });
});
