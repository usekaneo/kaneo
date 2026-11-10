import React from "react";
void React;
import { describe, it, expect } from "vite-plus/test";
import { render } from "@react-email/components";
import { CsatRequestEmail } from "../templates/csat-request";

const ratingUrls: [string, string, string, string, string] = [
  "https://acme.example.com/csat?token=abc&rating=1",
  "https://acme.example.com/csat?token=abc&rating=2",
  "https://acme.example.com/csat?token=abc&rating=3",
  "https://acme.example.com/csat?token=abc&rating=4",
  "https://acme.example.com/csat?token=abc&rating=5",
];

describe("CsatRequestEmail", () => {
  it("renders the prompt text and all 5 rating links", async () => {
    const html = await render(
      <CsatRequestEmail
        promptText="How did we do?"
        ratingUrls={ratingUrls}
        workspaceName="Acme"
      />,
    );
    expect(html).toContain("How did we do?");
    // react-email HTML-escapes `&` in href attributes.
    for (const url of ratingUrls) {
      expect(html).toContain(url.replaceAll("&", "&amp;"));
    }
    // All 5 emoji faces present.
    for (const face of ["😞", "🙁", "😐", "🙂", "😄"]) {
      expect(html).toContain(face);
    }
  });

  it("omits the prompt paragraph entirely when promptText is empty", async () => {
    const html = await render(
      <CsatRequestEmail
        promptText=""
        ratingUrls={ratingUrls}
        workspaceName="Acme"
      />,
    );
    expect(html).toContain("How did we do?");
    expect(html).not.toContain("How did we do, Acme?");
    // react-email HTML-escapes `&` in href attributes.
    for (const url of ratingUrls) {
      expect(html).toContain(url.replaceAll("&", "&amp;"));
    }
  });
});
