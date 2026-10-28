import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { OptionFieldEditor } from "./option-field-editor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

const field: CustomFieldDefinition = {
  id: "field-1",
  projectId: "project-1",
  name: "Platform",
  type: "multiselect",
  required: false,
  defaultValue: null,
  options: ["Web", "iOS", "Windows Phone"],
  hiddenOptions: ["Windows Phone"],
  position: 0,
  createdAt: "",
  updatedAt: "",
};

function renderEditor(selected: string[]) {
  render(
    <OptionFieldEditor
      field={field}
      selected={selected}
      onToggle={vi.fn()}
      onClear={vi.fn()}
    />,
  );
}

describe("OptionFieldEditor", () => {
  it("leaves hidden options out of new selections", () => {
    renderEditor([]);

    expect(screen.getByRole("option", { name: "Web" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Windows Phone" }),
    ).not.toBeInTheDocument();
  });

  it("keeps a hidden option the task already has so it can be removed", () => {
    renderEditor(["Windows Phone"]);

    expect(
      screen.getByRole("option", { name: "Windows Phone" }),
    ).toBeInTheDocument();
  });
});
