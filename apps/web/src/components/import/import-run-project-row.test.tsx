import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ImportRunProjectRow } from "@/components/import/import-run-project-row";
import type { ImportRunProject } from "@/fetchers/import/get-import-run";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; name?: string }) =>
      options?.count !== undefined
        ? `${key}:${options.count}`
        : options?.name
          ? `${key}:${options.name}`
          : key,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    ...props
  }: {
    children?: ReactNode;
    to: string;
    params: { projectId: string };
  }) => (
    <a href={`/board/${params.projectId}`} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

function project(patch: Partial<ImportRunProject>): ImportRunProject {
  return {
    sourceId: "s1",
    name: "Design",
    status: "completed",
    projectId: "p1",
    projectSlug: "DES",
    counts: {
      columns: 6,
      tasks: 86,
      labels: 0,
      comments: 108,
      assignees: 0,
      relations: 0,
    },
    warnings: [],
    error: null,
    ...patch,
  };
}

function renderRow(value: ImportRunProject, message: string | null = null) {
  render(
    <ul>
      <ImportRunProjectRow
        project={value}
        message={message}
        workspaceId="ws1"
      />
    </ul>,
  );
}

describe("ImportRunProjectRow", () => {
  it("summarizes a finished project and links to its board", () => {
    renderRow(project({}));

    expect(
      screen.getByText(
        "settings:workspaceImport.counts.tasks:86 · settings:workspaceImport.counts.columns:6 · settings:workspaceImport.counts.comments:108",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "settings:workspaceImport.run.openProject:Design",
      }),
    ).toHaveAttribute("href", "/board/p1");
  });

  it("shows the live message for the project being imported", () => {
    renderRow(
      project({ status: "running", projectId: null }),
      "Reading comments (300 so far)",
    );

    expect(
      screen.getByText("Reading comments (300 so far)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("settings:workspaceImport.run.importingBadge"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows why a project failed", () => {
    renderRow(
      project({
        status: "failed",
        projectId: null,
        error: "Linear rate limit reached.",
      }),
    );

    expect(screen.getByText("Linear rate limit reached.")).toBeInTheDocument();
    expect(
      screen.getByText("settings:workspaceImport.run.failedBadge"),
    ).toBeInTheDocument();
  });

  it("reveals warnings on demand", () => {
    renderRow(project({ warnings: ["Bo Chen is not in Acme."] }));

    const toggle = screen.getByRole("button", {
      name: /settings:workspaceImport\.run\.warnings:1/,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Bo Chen is not in Acme.")).toBeInTheDocument();
  });
});
