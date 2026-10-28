import { render } from "react-email";
import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";
import TestEmail from "./test-email";

describe("TestEmail", () => {
  it("names the recipient and instance without any links into Kaneo", async () => {
    const html = await render(
      createElement(TestEmail, {
        email: "admin@example.com",
        instance: "kaneo.example.com",
      }),
    );

    expect(html).toContain("Your email settings work");
    expect(html).toContain("admin@example.com");
    expect(html).toContain("kaneo.example.com");
    expect(html).not.toMatch(/href="https?:\/\/kaneo\.example\.com/);
  });
});
