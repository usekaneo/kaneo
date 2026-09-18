import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskAttachment } from "@/fetchers/task-attachment";
import TaskLinkAttachment from "./task-link-attachment";

const preview = vi.hoisted(() => ({ data: null as unknown }));
vi.mock("@/hooks/queries/use-link-preview", () => ({
  useLinkPreview: () => ({ data: preview.data }),
}));
vi.mock("@/lib/format", () => ({ formatDateMedium: () => "Sep 19, 2026" }));

const link = (title: string) =>
  ({
    id: "a1",
    kind: "link",
    title,
    url: "https://github.com/usekaneo/kaneo",
    createdByName: "Dev User",
    createdAt: "2026-09-19T00:00:00.000Z",
  }) as unknown as TaskAttachment;

afterEach(() => {
  cleanup();
  preview.data = null;
});

describe("TaskLinkAttachment", () => {
  it("keeps a typed title and shows the page's summary and picture", () => {
    preview.data = {
      title: "usekaneo/kaneo: Project management",
      description: "An open source project management platform",
      image: "https://opengraph.githubassets.com/x.png",
      siteName: "GitHub",
      favicon: "https://github.com/favicon.ico",
      youtubeId: null,
    };
    const { container } = render(
      <ul>
        <TaskLinkAttachment attachment={link("Our repo")} workspaceId="w1" />
      </ul>,
    );
    expect(screen.getByRole("link", { name: "Our repo" })).toHaveAttribute(
      "rel",
      "noopener noreferrer nofollow",
    );
    expect(
      screen.getByText("An open source project management platform"),
    ).toBeVisible();
    expect(screen.getByText("GitHub · Dev User · Sep 19, 2026")).toBeVisible();
    expect(
      container.querySelector(
        'img[src="https://opengraph.githubassets.com/x.png"]',
      ),
    ).not.toBeNull();
  });

  it("shows the page title for older links named after their host", () => {
    preview.data = {
      title: "usekaneo/kaneo: Project management",
      description: null,
      image: null,
      siteName: null,
      favicon: null,
      youtubeId: null,
    };
    render(
      <ul>
        <TaskLinkAttachment attachment={link("github.com")} workspaceId="w1" />
      </ul>,
    );
    expect(
      screen.getByRole("link", { name: "usekaneo/kaneo: Project management" }),
    ).toBeVisible();
  });

  it("falls back to the stored title and host when there's no preview", () => {
    render(
      <ul>
        <TaskLinkAttachment attachment={link("github.com")} workspaceId="w1" />
      </ul>,
    );
    expect(screen.getByRole("link", { name: "github.com" })).toBeVisible();
    expect(
      screen.getByText("github.com · Dev User · Sep 19, 2026"),
    ).toBeVisible();
  });
});
