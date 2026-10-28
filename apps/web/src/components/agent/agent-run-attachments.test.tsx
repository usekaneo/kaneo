import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { AgentRunAttachments } from "./agent-run-attachments";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name ? `${key}:${options.name}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

afterEach(cleanup);

describe("AgentRunAttachments", () => {
  it("shows text files, image thumbnails, and PDF links on a sent message", async () => {
    render(
      <AgentRunAttachments
        workspaceId="ws"
        attachments={[
          { type: "text", name: "notes.md", size: 12 },
          {
            type: "file",
            id: "img1",
            name: "mockup.png",
            mediaType: "image/png",
            size: 10,
          },
          {
            type: "file",
            id: "doc1",
            name: "spec.pdf",
            mediaType: "application/pdf",
            size: 20,
          },
        ]}
      />,
    );

    expect(screen.getByText("notes.md")).toBeInTheDocument();
    expect(screen.getByAltText("mockup.png").getAttribute("src")).toMatch(
      /\/agent\/ws\/attachments\/img1\/content$/,
    );
    expect(
      screen.getByRole("link", { name: "spec.pdf" }).getAttribute("href"),
    ).toMatch(/\/agent\/ws\/attachments\/doc1\/content$/);
    expect(screen.queryByLabelText(/removeAttachment/)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByLabelText("agent:composer.previewAttachment:mockup.png"),
    );
    expect(await screen.findAllByAltText("mockup.png")).toHaveLength(2);
  });

  it("renders nothing without attachments", () => {
    const { container } = render(
      <AgentRunAttachments workspaceId="ws" attachments={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
