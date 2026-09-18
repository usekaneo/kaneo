import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import ActivityEmail from "./activity";

describe("ActivityEmail", () => {
  it("renders the brand, card, quote and buttons", async () => {
    const html = await render(
      createElement(ActivityEmail, ActivityEmail.PreviewProps),
    );
    expect(html).toContain("Demo Company");
    expect(html).toContain("Nusrat Jahan asked for annual leave");
    expect(html).toContain("Waiting for you");
    expect(html).toContain("Family event in Chattogram");
    expect(html).toContain("Review request");
    expect(html).toContain("Manage email notifications");
  });

  it("escapes what people typed", async () => {
    const html = await render(
      createElement(ActivityEmail, {
        preview: "p",
        heading: "h",
        quote: { text: "<script>alert(1)</script>" },
      }),
    );
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("has a plain-text version with the button link", async () => {
    const text = await render(
      createElement(ActivityEmail, ActivityEmail.PreviewProps),
      {
        plainText: true,
      },
    );
    expect(text).toContain("Review request");
    expect(text).toContain("https://kaneo.app");
  });
});
