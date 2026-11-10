import { afterEach, expect, it, vi } from "vite-plus/test";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { WidgetView } from "../src/ui/index.js";
import {
  MAX_IMAGE_BYTES,
  safeMediaUrl,
  validateImage,
} from "../src/ui/media.js";
import { createMockBackend, emptySnapshot } from "../stories/mock-backend.js";

const png = (name = "image.png", extra = 0) =>
  new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, extra])], name, {
    type: "image/png",
  });
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it.each([
  new File(["bad"], "bad.svg", { type: "image/svg+xml" }),
  new File(["not a png"], "bad.png", { type: "image/png" }),
  new File([], "empty.png", { type: "image/png" }),
  new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "big.png", {
    type: "image/png",
  }),
])("rejects an invalid image: $name", async (file) => {
  await expect(validateImage(file)).rejects.toThrow();
});
it("recognizes supported headers and restricts image URLs", async () => {
  await expect(validateImage(png())).resolves.toBeUndefined();
  await expect(
    validateImage(
      new File([new Uint8Array([255, 216, 255])], "a.jpg", {
        type: "image/jpeg",
      }),
    ),
  ).resolves.toBeUndefined();
  await expect(
    validateImage(new File(["RIFFxxxxWEBP"], "a.webp", { type: "image/webp" })),
  ).resolves.toBeUndefined();
  expect(safeMediaUrl("https://example.test/image.png")).toBeDefined();
  expect(safeMediaUrl("data:image/svg+xml,attack")).toBeUndefined();
  expect(safeMediaUrl("blob:local")).toBeUndefined();
});
it("retains files through failure and Back, uses the same retry key, and releases preview URLs", async () => {
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:preview");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const submit = vi
    .fn()
    .mockRejectedValueOnce(new Error("lost"))
    .mockResolvedValue(undefined);
  render(
    <WidgetView
      onClose={vi.fn()}
      attachmentsEnabled
      onSubmitFeedback={submit}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Submit a request" }));
  const file = png();
  fireEvent.change(screen.getByLabelText("Choose images"), {
    target: { files: [file] },
  });
  await screen.findByRole("button", { name: "Edit image.png" });
  fireEvent.click(screen.getByRole("button", { name: "Post" }));
  await screen.findByRole("alert");
  const options = submit.mock.calls[0][1];
  fireEvent.change(screen.getByLabelText("Choose images"), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(screen.queryByText("Preparing image…")).toBeNull(),
  );
  expect(options.attachments).toEqual([file]);
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(revoke).toHaveBeenCalledWith("blob:preview");
  fireEvent.click(screen.getByRole("button", { name: "Submit a request" }));
  expect(screen.getByRole("button", { name: "Edit image.png" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Post" }));
  await screen.findByText("Feedback submitted.");
  expect(submit).toHaveBeenLastCalledWith("", options);
  expect(create).toHaveBeenCalledTimes(2);
  expect(revoke).toHaveBeenCalledTimes(2);
});
it("limits selections, allows removal, and aborts a pending capture on navigation", async () => {
  let signal: AbortSignal | undefined;
  const capture = vi.fn((value: AbortSignal) => {
    signal = value;
    return new Promise<File | null>(() => {});
  });
  render(
    <WidgetView
      onClose={vi.fn()}
      attachmentsEnabled
      onCaptureScreenshot={capture}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Submit a request" }));
  fireEvent.change(screen.getByLabelText("Choose images"), {
    target: { files: Array.from({ length: 5 }, (_, i) => png(`${i}.png`)) },
  });
  expect((await screen.findByRole("alert")).textContent).toContain("up to 4");
  fireEvent.change(screen.getByLabelText("Choose images"), {
    target: { files: [png()] },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: "Remove image.png" }),
  );
  await waitFor(() => expect(screen.queryByRole("img")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Capture screenshot" }));
  expect(signal?.aborted).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(signal?.aborted).toBe(true);
});
it("mock storage deduplicates bytes after a lost response and releases its URLs", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:saved");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const backend = createMockBackend(emptySnapshot, 0),
    signal = new AbortController().signal;
  const options = { idempotencyKey: "attachment", attachments: [png()] };
  backend.failNext("after");
  await expect(backend.feedback("a", "", options, signal)).rejects.toThrow(
    "response lost",
  );
  const saved = await backend.feedback(
    "a",
    "",
    { ...options, attachments: [png()] },
    signal,
  );
  expect(saved.feedback).toHaveLength(1);
  expect(saved.feedback[0].attachments?.[0].url).toBe("blob:saved");
  await expect(
    backend.feedback(
      "a",
      "",
      { ...options, attachments: [png("image.png", 1)] },
      signal,
    ),
  ).rejects.toThrow("different content");
  backend.dispose();
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:saved");
});

it.each(["button", "escape"])(
  "cancels capture on %s close even when the view stays mounted",
  async (method) => {
    let signal!: AbortSignal;
    let finish!: (file: File | null) => void;
    const close = vi.fn();
    const capture = (value: AbortSignal) => {
      signal = value;
      return new Promise<File | null>((resolve) => {
        finish = resolve;
      });
    };
    render(
      <WidgetView
        onClose={close}
        attachmentsEnabled
        onCaptureScreenshot={capture}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit a request" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Keep the draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Capture screenshot" }));
    if (method === "button")
      fireEvent.click(screen.getByRole("button", { name: "Close widget" }));
    else fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
    expect(signal.aborted).toBe(true);
    finish(png());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Keep the draft",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Capture screenshot",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  },
);
