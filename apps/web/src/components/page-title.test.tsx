import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import PageTitle from "./page-title";

afterEach(() => {
  cleanup();
  document.title = "";
});

describe("PageTitle", () => {
  it.each(["Board", "List", "Calendar", "Gantt", "Backlog"])(
    "formats the project %s view with the shared middle dot",
    (view) => {
      render(<PageTitle title="My project" suffix={view} />);
      expect(document.title).toBe(`My project · ${view}`);
    },
  );

  it("keeps other app pages using the same separator", () => {
    render(<PageTitle title="Workflow Settings" />);
    expect(document.title).toBe("Workflow Settings · Kaneo");
  });

  it("updates when the project or view changes", () => {
    const view = render(<PageTitle title="First" suffix="Board" />);
    view.rerender(<PageTitle title="Second" suffix="Calendar" />);
    expect(document.title).toBe("Second · Calendar");
  });

  it("shows only the view while the project is loading", () => {
    render(<PageTitle title="" suffix="Backlog" />);
    expect(document.title).toBe("Backlog");
  });

  it("preserves punctuation within names and task identifiers", () => {
    render(<PageTitle title="ABC-42 · Fix sign-in" hideAppName />);
    expect(document.title).toBe("ABC-42 · Fix sign-in");
  });

  it("supports an empty suffix", () => {
    render(<PageTitle title="Projects" suffix="" />);
    expect(document.title).toBe("Projects");
  });
});
