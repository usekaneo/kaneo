import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Turnstile } from "./turnstile";

afterEach(() => {
  cleanup();
  delete window.turnstile;
});
it("binds the auth action and removes consumed widgets before a new attempt", async () => {
  const widget = {
    render: vi.fn().mockReturnValueOnce("first").mockReturnValueOnce("second"),
    remove: vi.fn(),
    reset: vi.fn(),
  };
  window.turnstile = widget;
  const verify = vi.fn();
  const { rerender } = render(
    <Turnstile key={0} siteKey="test" onVerify={verify} />,
  );
  await waitFor(() => expect(widget.render).toHaveBeenCalledTimes(1));
  expect(widget.render.mock.calls[0]?.[1]).toMatchObject({
    sitekey: "test",
    action: "auth",
  });
  widget.render.mock.calls[0]?.[1].callback("token");
  expect(verify).toHaveBeenCalledWith("token");
  rerender(<Turnstile key={1} siteKey="test" onVerify={verify} />);
  await waitFor(() => expect(widget.render).toHaveBeenCalledTimes(2));
  expect(widget.remove).toHaveBeenCalledWith("first");
});
