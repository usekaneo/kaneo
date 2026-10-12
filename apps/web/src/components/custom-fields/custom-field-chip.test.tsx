import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { CustomFieldChip } from "./custom-field-chip";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const field = (
  overrides: Partial<CustomFieldDefinition>,
): CustomFieldDefinition => ({
  id: "field-1",
  projectId: "project-1",
  name: "Environment",
  type: "text",
  required: false,
  defaultValue: null,
  options: null,
  position: 0,
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("CustomFieldChip", () => {
  it("toggles booleans in place without a popover", () => {
    const onChange = vi.fn();
    render(
      <CustomFieldChip
        field={field({ type: "boolean", name: "Billable" })}
        value="false"
        onChange={onChange}
      />,
    );
    const toggle = screen.getByRole("checkbox", { name: "Billable" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith("true");
  });

  it("saves a dropdown pick", async () => {
    const onChange = vi.fn();
    render(
      <CustomFieldChip
        field={field({
          type: "dropdown",
          options: ["Staging", "Production"],
        })}
        value=""
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Environment/ }));
    fireEvent.click(await screen.findByText("Production"));
    expect(onChange).toHaveBeenCalledWith("Production");
  });

  it("keeps the old text when Escape closes the editor", async () => {
    const onChange = vi.fn();
    render(
      <CustomFieldChip
        field={field({ name: "Customer" })}
        value="Acme"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Customer/ }));
    const input = await screen.findByLabelText("Customer");
    fireEvent.change(input, { target: { value: "Other" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("never empties a required multiselect", async () => {
    const onChange = vi.fn();
    render(
      <CustomFieldChip
        field={field({
          type: "multiselect",
          name: "Platforms",
          required: true,
          options: ["Web", "iOS"],
        })}
        value='["Web"]'
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Platforms/ }));
    fireEvent.click(await screen.findByRole("option", { name: "Web" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("option", { name: "iOS" }));
    expect(onChange).toHaveBeenCalledWith('["Web","iOS"]');
    expect(screen.queryByText("tasks:customFields.clear")).toBeNull();
  });

  it("marks empty required fields for screen readers", () => {
    render(
      <CustomFieldChip
        field={field({ name: "Customer", required: true })}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Customer/ })).toHaveTextContent(
      "tasks:customFields.required",
    );
  });
});
