import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ParentTaskHint } from "./parent-task-hint";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, values: { id: string; title: string }) =>
      `parent: ${values.id} ${values.title}`,
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

afterEach(cleanup);

describe("ParentTaskHint", () => {
  it("shows the parent's ID and title on one line with the full text as a tooltip", () => {
    render(
      <ParentTaskHint
        parent={{
          number: 8,
          projectSlug: "AMI",
          title: "Dokończyć plan animacji na cały sezon",
        }}
      />,
    );
    const hint = screen.getByText(
      "parent: AMI-8 Dokończyć plan animacji na cały sezon",
    );
    expect(hint).toHaveAttribute(
      "title",
      "parent: AMI-8 Dokończyć plan animacji na cały sezon",
    );
    expect(hint).toHaveClass("truncate");
  });

  it("renders nothing for a task without a parent", () => {
    const { container } = render(<ParentTaskHint parent={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
