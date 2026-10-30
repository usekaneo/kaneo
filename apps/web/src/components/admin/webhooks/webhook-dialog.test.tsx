import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import enUS from "@i18n/en-US.json";
import type { AdminWebhook } from "@/fetchers/admin/webhook-types";
import { WebhookDialog } from "./webhook-dialog";

const mutation = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue({}),
  reset: vi.fn(),
  isPending: false,
}));
vi.mock("@/hooks/mutations/admin/use-admin-webhook-mutation", () => ({
  default: () => mutation,
}));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string) => {
      const [namespace, path] = key.split(":");
      let value: unknown = enUS[namespace as keyof typeof enUS];
      for (const part of path!.split("."))
        value = (value as Record<string, unknown>)?.[part];
      return value ?? key;
    },
  }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const webhook: AdminWebhook = {
  id: "w1",
  url: "https://example.com/events",
  categories: ["user"],
  enabled: true,
  createdAt: "2026-10-27T12:00:00Z",
};

describe("WebhookDialog", () => {
  it("labels Save and submits the edited enabled state without displaying a secret", async () => {
    const onClose = vi.fn();
    const onSecret = vi.fn();
    render(
      <WebhookDialog webhook={webhook} onClose={onClose} onSecret={onSecret} />,
    );
    expect(screen.getByLabelText("URL")).toHaveValue(webhook.url);
    expect(screen.queryByLabelText("Signing secret")).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Enabled" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(mutation.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookId: "w1",
        enabled: false,
        categories: ["user"],
      }),
    );
    expect(onSecret).not.toHaveBeenCalled();
  });
});
