import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { Dialog, DialogPopup } from "@/components/ui/dialog";
import { AddModelForm } from "./add-model-form";

const sonnet = {
  id: "anthropic:claude-sonnet-5-5",
  label: "Claude Sonnet 5.5",
};
const haiku = { id: "anthropic:claude-haiku-5-5", label: "Claude Haiku 5.5" };
vi.mock("react-i18next", async (original) => ({
  ...(await original<object>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/admin/use-admin-model-catalog", () => ({
  useAdminModelCatalog: () => ({
    data: { supported: true, models: [sonnet, haiku] },
    isLoading: false,
    isError: false,
  }),
}));
afterEach(cleanup);

function renderForm(onAdd = vi.fn()) {
  render(
    <Dialog open>
      <DialogPopup>
        <AddModelForm
          providers={[{ id: "anthropic", label: "Anthropic" }]}
          selectedIds={[sonnet.id]}
          pending={false}
          onAdd={onAdd}
          onClose={vi.fn()}
        />
      </DialogPopup>
    </Dialog>,
  );
  return onAdd;
}

it("adds a model chosen from the provider catalog", async () => {
  const onAdd = renderForm();
  const add = screen.getByRole("button", { name: "settings:adminAgent.add" });
  expect(add).toBeDisabled();
  const search = screen.getByRole("combobox", {
    name: "settings:adminAgent.model",
  });
  fireEvent.change(search, { target: { value: "Haiku" } });
  fireEvent.keyDown(search, { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: haiku.label }));
  fireEvent.click(add);
  expect(onAdd).toHaveBeenCalledWith(haiku);
});

it("hides models that are already allowed", async () => {
  renderForm();
  const search = screen.getByRole("combobox", {
    name: "settings:adminAgent.model",
  });
  fireEvent.keyDown(search, { key: "ArrowDown" });
  await screen.findByRole("option", { name: haiku.label });
  expect(screen.queryByRole("option", { name: sonnet.label })).toBeNull();
});

it("qualifies a manually entered model ID with the provider", () => {
  const onAdd = renderForm();
  fireEvent.click(
    screen.getByRole("button", { name: "settings:adminAgent.enterModelId" }),
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: "settings:adminAgent.modelId" }),
    { target: { value: "claude-opus-5-5" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "settings:adminAgent.add" }),
  );
  expect(onAdd).toHaveBeenCalledWith({
    id: "anthropic:claude-opus-5-5",
    label: "claude-opus-5-5",
  });
});
