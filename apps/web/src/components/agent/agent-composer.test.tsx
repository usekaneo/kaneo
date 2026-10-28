import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { toast } from "@/lib/toast";
import type { AgentRunAttachmentInput } from "@/types/agent";
import { AgentComposer } from "./agent-composer";
import { useAgentAttachments } from "./use-agent-attachments";

const mocks = vi.hoisted(() => ({ upload: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name ? `${key}:${options.name}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/fetchers/agent/upload-agent-attachment", () => ({
  default: mocks.upload,
}));
vi.mock("./agent-review-badge", () => ({ AgentReviewBadge: () => null }));

function Harness({
  onSubmit,
}: {
  onSubmit: (input: AgentRunAttachmentInput[]) => void;
}) {
  const attachments = useAgentAttachments("workspace");
  const [value, setValue] = useState("Describe this");
  return (
    <AgentComposer
      value={value}
      onValueChange={setValue}
      attachments={attachments}
      onSubmit={() => onSubmit(attachments.toRunInput())}
      placeholder="Ask"
    />
  );
}

function setup() {
  const onSubmit = vi.fn();
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <Harness onSubmit={onSubmit} />
    </QueryClientProvider>,
  );
  return { ...view, onSubmit, textarea: screen.getByLabelText("Ask") };
}

const image = (name = "image.png") =>
  new File(["png"], name, { type: "image/png" });
const send = () => screen.getByLabelText("agent:composer.send");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  let count = 0;
  URL.createObjectURL = vi.fn(() => `blob:preview-${++count}`);
  URL.revokeObjectURL = vi.fn();
  mocks.upload.mockReset();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AgentComposer attachments", () => {
  it("uploads a pasted screenshot, shows its thumbnail, and sends its id", async () => {
    const upload = deferred<{ id: string }>();
    mocks.upload.mockReturnValue(upload.promise);
    const { textarea, onSubmit } = setup();

    const pasted = fireEvent.paste(textarea, {
      clipboardData: { files: [image()] },
    });
    expect(pasted).toBe(false);

    expect(
      await screen.findByLabelText("agent:composer.uploading:image.png"),
    ).toBeInTheDocument();
    expect(screen.getByAltText("image.png")).toHaveAttribute(
      "src",
      "blob:preview-1",
    );
    expect(send()).toBeDisabled();
    expect(mocks.upload).toHaveBeenCalledWith("workspace", {
      name: "image.png",
      mediaType: "image/png",
      file: expect.any(File),
    });

    await act(async () => upload.resolve({ id: "upload-1" }));
    await waitFor(() => expect(send()).toBeEnabled());
    expect(
      screen.queryByLabelText("agent:composer.uploading:image.png"),
    ).not.toBeInTheDocument();

    fireEvent.click(send());
    expect(onSubmit).toHaveBeenCalledWith([{ id: "upload-1" }]);
  });

  it("leaves plain text pastes to the textarea", () => {
    const { textarea } = setup();
    expect(fireEvent.paste(textarea, { clipboardData: { files: [] } })).toBe(
      true,
    );
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("accepts several dropped files and keeps their order", async () => {
    mocks.upload
      .mockResolvedValueOnce({ id: "img" })
      .mockResolvedValueOnce({ id: "pdf" });
    const { container, onSubmit } = setup();
    const form = container.querySelector("form") as HTMLFormElement;

    fireEvent.drop(form, {
      dataTransfer: {
        types: ["Files"],
        files: [
          image("mockup.png"),
          new File(["%PDF-"], "spec.pdf", { type: "application/pdf" }),
          new File(["Notes"], "notes.md", { type: "text/markdown" }),
        ],
      },
    });

    expect(await screen.findByText("spec.pdf")).toBeInTheDocument();
    expect(await screen.findByText("notes.md")).toBeInTheDocument();
    await waitFor(() => expect(send()).toBeEnabled());
    fireEvent.click(send());
    expect(onSubmit).toHaveBeenCalledWith([
      { id: "img" },
      { id: "pdf" },
      { name: "notes.md", content: "Notes" },
    ]);
  });

  it("adds files from the picker and removes them before sending", async () => {
    mocks.upload.mockResolvedValue({ id: "upload-1" });
    const { container, onSubmit } = setup();
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [image("shot.png")] } });
    await waitFor(() => expect(send()).toBeEnabled());
    expect(screen.getByAltText("shot.png")).toBeInTheDocument();

    fireEvent.click(
      screen.getByLabelText("agent:composer.removeAttachment:shot.png"),
    );
    expect(screen.queryByAltText("shot.png")).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
    fireEvent.click(send());
    expect(onSubmit).toHaveBeenCalledWith([]);
  });

  it("drops a failed upload and explains why", async () => {
    mocks.upload.mockRejectedValue(new HttpError(413, "too large"));
    const { textarea } = setup();

    fireEvent.paste(textarea, { clipboardData: { files: [image()] } });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "agent:composer.attachmentErrors.fileTooLarge:image.png",
      ),
    );
    expect(screen.queryByAltText("image.png")).not.toBeInTheDocument();
    expect(send()).toBeEnabled();
  });

  it("rejects unsupported files without uploading them", async () => {
    const { textarea } = setup();

    fireEvent.paste(textarea, {
      clipboardData: {
        files: [new File(["x"], "a.zip", { type: "application/zip" })],
      },
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "agent:composer.attachmentErrors.unsupported",
      ),
    );
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
