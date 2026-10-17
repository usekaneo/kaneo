import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { BulkOptionPopover } from "./bulk-option-popover";
import { useBulkRequestStore } from "./bulk-request-store";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  useBulkRequestStore.setState({ request: null, temporaryTaskId: null });
});

function renderPopover(onDismiss = vi.fn()) {
  render(
    <BulkOptionPopover
      icon={null}
      label="Status"
      placeholder="Change status"
      options={[{ value: "done", label: "Done" }]}
      onSelect={vi.fn()}
      picker="status"
      onDismiss={onDismiss}
    />,
  );
  return onDismiss;
}

describe("BulkOptionPopover", () => {
  it("opens when a keyboard request names its picker", async () => {
    renderPopover();

    act(() => useBulkRequestStore.getState().send("priority", null));
    expect(screen.queryByPlaceholderText("Change status")).toBeNull();

    act(() => useBulkRequestStore.getState().send("status", "task-1"));

    expect(await screen.findByPlaceholderText("Change status")).toBeTruthy();
    expect(useBulkRequestStore.getState().request).toBeNull();
  });

  it("reports a dismissal so a temporary selection can be dropped", async () => {
    const onDismiss = renderPopover();
    act(() => useBulkRequestStore.getState().send("status", "task-1"));
    const input = await screen.findByPlaceholderText("Change status");

    fireEvent.keyDown(input, { key: "Escape", code: "Escape" });

    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
  });
});
