import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { CardFieldList } from "./card-field-list";
import type { CardField } from "./card-fields";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const fields: CardField[] = [
  { fieldId: "points", name: "Story points", type: "number", value: "5" },
  { fieldId: "billable", name: "Billable", type: "boolean", value: "true" },
  { fieldId: "customer", name: "Customer", type: "text", value: "Acme Corp" },
  {
    fieldId: "platforms",
    name: "Platforms",
    type: "multiselect",
    value: '["Web","iOS","Android"]',
  },
];

describe("CardFieldList", () => {
  it("shows the first chips and counts the rest", () => {
    render(<CardFieldList fields={fields} max={2} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Billable")).toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).toBeNull();
    expect(
      screen.getByRole("button", { name: "tasks:customFields.moreFields" }),
    ).toHaveTextContent("+2");
  });

  it("formats multiselect values and skips the overflow chip when all fit", () => {
    render(<CardFieldList fields={fields.slice(3)} max={3} />);
    expect(screen.getByText("Web, iOS")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names each value", () => {
    render(<CardFieldList fields={fields.slice(0, 1)} max={3} />);
    expect(screen.getByText("Story points")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders nothing without fields", () => {
    const { container } = render(<CardFieldList fields={[]} max={2} />);
    expect(container).toBeEmptyDOMElement();
  });
});
