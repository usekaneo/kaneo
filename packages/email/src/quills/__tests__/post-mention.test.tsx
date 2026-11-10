import React from "react";
void React;
import { describe, it, expect } from "vite-plus/test";
import { render } from "@react-email/components";
import { PostMentionEmail } from "../templates/post-mention";

describe("PostMentionEmail", () => {
  it("renders mentioner name, post title, and excerpt", async () => {
    const html = await render(
      <PostMentionEmail
        mentionerName="Alex"
        postTitle="Why we should add dark mode"
        excerpt="Hey, take a look at this proposal."
        postUrl="https://example.com/p/123"
        workspaceName="Acme"
      />,
    );
    expect(html).toContain("Alex");
    expect(html).toContain("Why we should add dark mode");
    expect(html).toContain("Hey, take a look at this proposal.");
    expect(html).toContain("https://example.com/p/123");
  });

  it('uses "Anonymous user" fallback when mentionerName is empty', async () => {
    const html = await render(
      <PostMentionEmail
        mentionerName=""
        postTitle="Test"
        excerpt=""
        postUrl="https://example.com/p/1"
        workspaceName="Acme"
      />,
    );
    expect(html).toContain("Anonymous user");
  });

  it("omits the excerpt block when excerpt is empty", async () => {
    const html = await render(
      <PostMentionEmail
        mentionerName="Alex"
        postTitle="Test"
        excerpt=""
        postUrl="https://example.com/p/1"
        workspaceName="Acme"
      />,
    );
    expect(html).not.toMatch(/blockquote[^>]*>\s*</);
  });
});
