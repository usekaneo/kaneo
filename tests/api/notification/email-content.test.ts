import { describe, expect, it } from "vitest";
import {
  brandFor,
  buildNotificationEmail,
  type EmailContext,
} from "../../../apps/api/src/notification-preferences/email-content";

const context: EmailContext = {
  workspaceId: "w1",
  workspaceName: "Demo Company",
  workspaceLogo: null,
  projectName: "Website Redesign",
  taskTitle: "Fix the header",
  actionUrl: "https://app.example.com/task/1",
};

const build = (type: string, eventData: Record<string, unknown> = {}) =>
  buildNotificationEmail({
    type,
    eventData,
    context,
    recipientName: "Nusrat",
    fallback: { title: "Fallback title", body: "Fallback body" },
  });

describe("buildNotificationEmail", () => {
  it("gives an assignment a task card and an Open task button", () => {
    const email = build("task_assignee_changed");
    expect(email.subject).toBe("You've been assigned: Fix the header");
    expect(email.category).toBe("task_assigned");
    expect(email.props.card?.subtitle).toBe("Website Redesign · Demo Company");
    expect(email.props.primary).toEqual({
      label: "Open task",
      url: "https://app.example.com/task/1",
    });
    expect(email.props.manageUrl).toMatch(
      /\/dashboard\/settings\/account\/notifications$/,
    );
  });

  it("quotes comments as plain text", () => {
    const email = build("task_comment", {
      commenterName: "Tanvir",
      commentPreview: "<p>Looks <strong>great</strong>, ship it</p>",
    });
    expect(email.subject).toBe("Tanvir commented on Fix the header");
    expect(email.props.quote).toEqual({
      author: "Tanvir",
      text: "Looks great , ship it",
    });
  });

  it("marks overdue tasks as danger", () => {
    const email = build("task_overdue", { dueDate: "2026-09-17T00:00:00Z" });
    expect(email.props.card?.status).toEqual({
      label: "Overdue",
      tone: "danger",
    });
    expect(email.props.card?.details).toEqual([
      { label: "Due", value: "Thu, Sep 17, 2026" },
    ]);
  });

  it("asks approvers to review leave, with the reason", () => {
    const email = build("leave_requested", {
      userName: "Nusrat Jahan",
      type: "annual",
      startDate: "2026-09-22",
      endDate: "2026-09-23",
      days: 2,
      reason: "Family event",
    });
    expect(email.subject).toBe(
      "Nusrat Jahan asked for annual leave (Tue, Sep 22, 2026 – Wed, Sep 23, 2026)",
    );
    expect(email.props.primary?.label).toBe("Review request");
    expect(email.props.quote?.text).toBe("Family event");
    expect(email.props.card?.details).toContainEqual({
      label: "Working days",
      value: "2",
    });
  });

  it("tells the person how their leave was decided, with the note", () => {
    const rejected = build("leave_rejected", {
      type: "sick",
      startDate: "2026-09-22",
      endDate: "2026-09-22",
      actorName: "Mona",
      note: "Release week",
    });
    expect(rejected.subject).toBe(
      "Your sick leave was rejected (Tue, Sep 22, 2026)",
    );
    expect(rejected.props.card?.status?.tone).toBe("danger");
    expect(rejected.props.quote).toEqual({
      author: "Mona",
      text: "Release week",
    });
  });

  it("falls back to the stored wording for unknown types", () => {
    const email = build("something_new");
    expect(email.subject).toBe("Fallback title");
    expect(email.category).toBe("other");
  });
});

describe("brandFor", () => {
  it("only uses hosted https logos", () => {
    expect(
      brandFor({ ...context, workspaceLogo: "https://x.com/a.png" }).logoUrl,
    ).toBe("https://x.com/a.png");
    expect(
      brandFor({ ...context, workspaceLogo: "data:image/png;base64,AAAA" })
        .logoUrl,
    ).toBeNull();
  });
});
