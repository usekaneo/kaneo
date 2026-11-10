import React from "react";
void React;
import { describe, expect, it } from "vite-plus/test";
import { render } from "@react-email/components";
import { StatusIncidentPublishedEmail } from "../templates/status-incident-published";
import { StatusMaintenanceScheduledEmail } from "../templates/status-maintenance-scheduled";

const incident = {
  workspaceName: "Acme",
  incidentTitle: "API errors",
  impact: "major" as const,
  statusLabel: "Investigating",
  affectedComponents: [{ name: "API", status: "Partial outage" }],
  incidentUrl: "https://acme.example.com/status/status_incident_1",
  unsubscribeUrl: "https://acme.example.com/unsubscribe?token=t",
};

describe("StatusIncidentPublishedEmail", () => {
  it("keeps the line breaks the update was written with", async () => {
    const html = await render(
      <StatusIncidentPublishedEmail
        {...incident}
        body={
          "We are seeing errors.\nA fix is rolling out.\r\nNext update in 30 minutes."
        }
      />,
    );
    expect(html).toMatch(
      /We are seeing errors\.<br\s*\/?>A fix is rolling out\.<br\s*\/?>Next/,
    );
  });

  it("escapes markup in the body instead of rendering it", async () => {
    const html = await render(
      <StatusIncidentPublishedEmail
        {...incident}
        body={"<img src=x onerror=alert(1)>\nhello"}
      />,
    );
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toMatch(/<br\s*\/?>hello/);
  });
});

const maintenance = {
  workspaceName: "Acme",
  maintenanceTitle: "Database upgrade",
  startLabel: "October 12, 2026 at 02:00 UTC",
  endLabel: "October 12, 2026 at 04:00 UTC",
  affectedComponents: ["API"],
  incidentUrl: "https://acme.example.com/status/status_incident_2",
  unsubscribeUrl: "https://acme.example.com/unsubscribe?token=t",
};

describe("StatusMaintenanceScheduledEmail", () => {
  it("keeps the line breaks the description was written with", async () => {
    const html = await render(
      <StatusMaintenanceScheduledEmail
        {...maintenance}
        body={"Writes pause briefly.\nReads stay up."}
      />,
    );
    expect(html).toMatch(/Writes pause briefly\.<br\s*\/?>Reads stay up\./);
  });
});

describe("status email wording", () => {
  const emails = {
    incident: () => (
      <StatusIncidentPublishedEmail
        {...incident}
        body="We are seeing errors."
      />
    ),
    maintenance: () => (
      <StatusMaintenanceScheduledEmail {...maintenance} body="Writes pause." />
    ),
  };

  for (const [name, email] of Object.entries(emails)) {
    it(`speaks of services, as the status page does (${name})`, async () => {
      const html = await render(email());
      expect(html).toContain("Affected services");
      expect(html).not.toContain("Affected components");
    });

    it(`offers to unsubscribe from status updates, not from a post (${name})`, async () => {
      const html = await render(email());
      expect(html).toMatch(
        /<a[^>]*href="https:\/\/acme\.example\.com\/unsubscribe\?token=t"[^>]*>Unsubscribe from status updates<\/a>/,
      );
      expect(html).not.toContain("Unsubscribe from this post");
    });
  }
});
