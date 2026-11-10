import { describe, it, expect } from "vite-plus/test";
import { render } from "@react-email/components";
import { ChangelogPublishedEmail } from "../templates/changelog-published";

const BASE = {
  changelogTitle: "May Release",
  changelogUrl: "https://example.com/changelog/changelog_01",
  contentPreview: "A short plain-text preview",
  organizationName: "Acme",
  unsubscribeUrl: "https://example.com/unsubscribe?token=t",
};

describe("ChangelogPublishedEmail rich body", () => {
  it("renders the full formatted body including an inline image when bodyHtml is provided", async () => {
    const bodyHtml =
      "<p>Intro with <strong>bold</strong> and <em>italic</em>.</p>" +
      '<p><img src="https://example.com/api/storage/changelog-images/shot.png?email=1" alt="Screenshot" /></p>' +
      "<ul><li>First improvement</li><li>Second improvement</li></ul>";
    const html = await render(ChangelogPublishedEmail({ ...BASE, bodyHtml }));

    expect(html).toContain("<strong>bold</strong>");
    expect(html).toMatch(/<div[^>]*class="k-text-85"[^>]*><p>Intro with/);
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain(
      'src="https://example.com/api/storage/changelog-images/shot.png?email=1"',
    );
    expect(html).toContain('alt="Screenshot"');
    expect(html).toContain("<li>First improvement</li>");
    // The full body replaces the truncated preview excerpt.
    expect(html).not.toContain("A short plain-text preview");
  });

  it("falls back to the plain preview excerpt when no bodyHtml is provided", async () => {
    const html = await render(ChangelogPublishedEmail({ ...BASE }));
    expect(html).toContain("A short plain-text preview");
  });
});
