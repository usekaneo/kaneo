import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vite-plus/test";

// Mock nodemailer so we can capture sendMail invocations without a real socket.
const sendMailMock = vi.fn().mockResolvedValue({ messageId: "test-msg-id" });
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail: sendMailMock }),
  },
}));

import { sendTicketEventEmail, type TicketEmailKind } from "../index";
import { sendingAs } from "./brands";

const ENV_KEYS = [
  "EMAIL_SMTP_HOST",
  "EMAIL_SMTP_PORT",
  "EMAIL_SMTP_USER",
  "EMAIL_SMTP_PASS",
  "EMAIL_SES_ACCESS_KEY_ID",
  "EMAIL_SES_SECRET_ACCESS_KEY",
  "EMAIL_FROM",
];

const baseParams = {
  to: "requester@example.com",
  ticketLabel: "#142",
  title: "Export fails on large CSV",
  workspaceName: "Acme",
  ctaUrl: "https://acme.example.com/support/ticket/ticket_1",
};

describe("sendTicketEventEmail", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.env.EMAIL_SMTP_HOST = "smtp.example.com";
    process.env.EMAIL_FROM = "noreply@example.com";
    sendMailMock.mockClear();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] !== undefined) {
        process.env[key] = saved[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it.each<[TicketEmailKind, string]>([
    ["created", "We received your ticket #142: Export fails on large CSV"],
    ["reply", "New reply on #142: Export fails on large CSV"],
    ["status_resolved", "Your ticket #142 was resolved"],
    ["assigned", "Ticket #142 assigned to you"],
    ["assigned_team", "Ticket #142 assigned to your team"],
  ])("sends kind %s with the mapped subject", async (kind, subject) => {
    const result = await sendTicketEventEmail({ ...baseParams, kind });
    expect(result.sent).toBe(true);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0];
    expect(call.subject).toBe(subject);
    expect(call.to).toBe("requester@example.com");
    expect(call.from).toBe("noreply@example.com");
  });

  it("sends SLA kinds with the clock facts in the subject", async () => {
    await sendTicketEventEmail({
      ...baseParams,
      kind: "sla_warning",
      title: "jane@customer.io",
      clockLabel: "first response",
      dueLabel: "in 32 minutes",
    });
    expect(sendMailMock.mock.calls[0][0].subject).toBe(
      "SLA at risk: first response due in 32 minutes",
    );
  });

  it('B22: status_resolved with closedGeneric says "closed", never "resolved"', async () => {
    const result = await sendTicketEventEmail({
      ...baseParams,
      kind: "status_resolved",
      statusChange: { previousLabel: "In progress", newLabel: "Closed" },
      closedGeneric: true,
    });
    expect(result.sent).toBe(true);
    const call = sendMailMock.mock.calls[0][0];
    expect(call.subject).toBe("Your ticket #142 was closed");
  });

  it("forwards threading headers, replyTo, and the from override when provided", async () => {
    await sendTicketEventEmail({
      ...baseParams,
      kind: "reply",
      messageBody: "Full reply body",
      authorName: "Sarah",
      from: sendingAs("support@acme-support.example.com"),
      replyTo: "inbound+tkt-ticket_1-abc123@mail.example.com",
      messageId: "msg-1@mail.example.com",
      inReplyTo: "ticket-ticket_1@mail.example.com",
      references: ["ticket-ticket_1@mail.example.com"],
    });
    const call = sendMailMock.mock.calls[0][0];
    expect(call.from).toBe("support@acme-support.example.com");
    expect(call.replyTo).toBe("inbound+tkt-ticket_1-abc123@mail.example.com");
    expect(call.messageId).toBe("<msg-1@mail.example.com>");
    expect(call.inReplyTo).toBe("<ticket-ticket_1@mail.example.com>");
    expect(call.references).toBe("<ticket-ticket_1@mail.example.com>");
  });

  it("omits threading headers and replyTo when not provided", async () => {
    await sendTicketEventEmail({ ...baseParams, kind: "created" });
    const call = sendMailMock.mock.calls[0][0];
    expect(call.replyTo).toBeUndefined();
    expect(call.messageId).toBeUndefined();
    expect(call.references).toBeUndefined();
  });

  it("returns { sent: false } from the console provider without sending", async () => {
    delete process.env.EMAIL_SMTP_HOST;
    const result = await sendTicketEventEmail({
      ...baseParams,
      kind: "created",
    });
    expect(result.sent).toBe(false);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
