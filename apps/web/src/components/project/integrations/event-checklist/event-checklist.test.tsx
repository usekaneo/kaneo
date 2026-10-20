import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { EventChecklist } from "./event-checklist";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const items = [
  { id: "created", labelKey: "events.created" },
  { id: "deleted", labelKey: "events.deleted" },
] as const;

describe("EventChecklist", () => {
  afterEach(cleanup);

  it("renders one labelled group with a checkbox per event", () => {
    render(
      <EventChecklist
        items={[...items]}
        label="Post when"
        onChange={vi.fn()}
        value={{ created: true, deleted: false }}
      />,
    );

    expect(screen.getByRole("group", { name: "Post when" })).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "events.created" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "events.deleted" }),
    ).not.toBeChecked();
  });

  it("reports the full event map when one event is toggled", () => {
    const onChange = vi.fn();
    render(
      <EventChecklist
        items={[...items]}
        label="Post when"
        onChange={onChange}
        value={{ created: true, deleted: false }}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "events.deleted" }));

    expect(onChange).toHaveBeenCalledWith({ created: true, deleted: true });
  });

  it("renders extra content inside the list", () => {
    render(
      <EventChecklist
        columns={3}
        items={[...items]}
        label="Send when"
        onChange={vi.fn()}
        value={{ created: false, deleted: false }}
      >
        <span>Reminder timing</span>
      </EventChecklist>,
    );

    expect(screen.getByText("Reminder timing")).toBeTruthy();
  });
});
