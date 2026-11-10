import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vite-plus/test";
import {
  sendChangelogPublishedEmail,
  sendInvitationEmail,
  sendRawEmail,
} from "../index";
import { sealedTo, sendingAs } from "./brands";
import {
  clearMailbox,
  getHeaders,
  getMessage,
  mailpitAvailable,
  useMailpitEnv,
  waitForMessages,
} from "./mailpit-fixture";

/**
 * End-to-end delivery against the mailpit container from docker-compose.
 *
 * The rest of the email suite runs in console mode and asserts `{ sent: false }`,
 * which covers provider selection but never renders a template or produces a
 * MIME message. These tests take the real SMTP path and assert on what a mail
 * client would actually receive.
 *
 * Threading is the reason this matters: the conversation email channel relies on
 * Message-ID / In-Reply-To / References to keep a reply in the customer's
 * existing thread, and nothing else in the suite exercises those headers.
 */
describe.skipIf(!mailpitAvailable)(
  "email delivery (real SMTP via mailpit)",
  () => {
    let restoreEnv: () => void;

    beforeAll(() => {
      restoreEnv = useMailpitEnv();
    });
    afterAll(() => restoreEnv?.());
    beforeEach(() => clearMailbox());

    it("delivers a branded template as a real MIME message", async () => {
      const result = await sendInvitationEmail({
        to: sealedTo("invitee@example.test"),
        invitedByName: "Ada Lovelace",
        workspaceName: "Acme Corp",
        inviteLink: "https://acme.test/invite/abc123",
      });
      expect(result.sent).toBe(true);

      const [summary] = await waitForMessages(1);
      expect(summary.To[0].Address).toBe("invitee@example.test");
      expect(summary.Subject).toContain("Acme Corp");

      // The React template actually rendered, rather than a template object
      // being stringified into the body.
      const message = await getMessage(summary.ID);
      expect(message.HTML).toContain("https://acme.test/invite/abc123");
      expect(message.HTML).toContain("Ada Lovelace");
      expect(message.HTML).not.toContain("[object Object]");
    });

    it("sends a raw email from an explicit sender, not EMAIL_FROM", async () => {
      // The conversation channel replies as the inbox identity
      // (channel_accounts.address), which is the whole point of sendRawEmail.
      const result = await sendRawEmail({
        from: sendingAs("Support <support@acme.test>"),
        to: "customer@example.test",
        subject: "Re: your question",
        html: "<p>Thanks for getting in touch.</p>",
      });
      expect(result.sent).toBe(true);

      const [summary] = await waitForMessages(1);
      expect(summary.From.Address).toBe("support@acme.test");
      expect(summary.To[0].Address).toBe("customer@example.test");
    });

    it("preserves the RFC 5322 threading headers a reply depends on", async () => {
      const parentId = "conv-42-msg-1@quackback.test";
      const rootId = "conv-42-root@quackback.test";

      await sendRawEmail({
        from: sendingAs("Support <support@acme.test>"),
        to: "customer@example.test",
        subject: "Re: your question",
        html: "<p>Following up.</p>",
        messageId: "conv-42-msg-2@quackback.test",
        inReplyTo: parentId,
        references: [rootId, parentId],
      });

      const [summary] = await waitForMessages(1);
      const headers = await getHeaders(summary.ID);

      // Angle brackets are added by buildThreadingHeaders and are what makes a
      // client thread the message rather than start a new conversation.
      expect(headers["Message-Id"]?.[0] ?? headers["Message-ID"]?.[0]).toBe(
        "<conv-42-msg-2@quackback.test>",
      );
      expect(headers["In-Reply-To"]?.[0]).toBe(`<${parentId}>`);
      expect(headers["References"]?.[0]).toBe(`<${rootId}> <${parentId}>`);
    });

    it("delivers a real MIME attachment alongside the body", async () => {
      const content = new TextEncoder().encode("id,name\n1,ada\n2,grace");
      const result = await sendRawEmail({
        from: sendingAs("Support <support@acme.test>"),
        to: "customer@example.test",
        subject: "Your export",
        html: "<p>Your export is attached.</p>",
        attachments: [
          { filename: "export.csv", contentType: "text/csv", content },
        ],
      });
      expect(result.sent).toBe(true);

      const [summary] = await waitForMessages(1);
      const message = await getMessage(summary.ID);
      expect(message.Attachments).toHaveLength(1);
      expect(message.Attachments[0].FileName).toBe("export.csv");
      expect(message.Attachments[0].ContentType).toBe("text/csv");
      expect(message.Attachments[0].Size).toBe(content.byteLength);
    });

    it("delivers RFC 8058 one-click unsubscribe headers on a changelog email", async () => {
      const result = await sendChangelogPublishedEmail({
        to: "subscriber@example.test",
        changelogTitle: "May release",
        changelogUrl: "https://acme.test/changelog/1",
        contentPreview: "New things",
        workspaceName: "Acme",
        unsubscribeUrl: "https://acme.test/unsubscribe?token=tok-smtp",
      });
      expect(result.sent).toBe(true);

      const [summary] = await waitForMessages(1);
      const headers = await getHeaders(summary.ID);
      expect(headers["List-Unsubscribe"]).toEqual([
        "<https://acme.test/unsubscribe?token=tok-smtp>",
      ]);
      expect(headers["List-Unsubscribe-Post"]).toEqual([
        "List-Unsubscribe=One-Click",
      ]);
    });

    it("refuses to deliver to a synthetic anonymous address", async () => {
      // Anonymous principals carry temp-<id>@anon.quills.io, which is not
      // deliverable. The guard should drop it before it reaches the transport.
      const result = await sendRawEmail({
        from: sendingAs("Support <support@acme.test>"),
        to: "temp-abc123@anon.quills.io",
        subject: "Should never arrive",
        html: "<p>nope</p>",
      });

      expect(result.sent).toBe(false);
      await expect(waitForMessages(1, 1000)).rejects.toThrow(
        /expected 1 message/,
      );
    });
  },
);
