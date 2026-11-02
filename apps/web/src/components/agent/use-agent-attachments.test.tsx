import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useAgentAttachments } from "./use-agent-attachments";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), error: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/mutations/agent/use-upload-agent-attachment", () => ({
  default: () => ({ mutateAsync: mocks.upload }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.error } }));
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function textFile(name: string, content: string | Promise<string>) {
  const file = new File(["text"], name, { type: "text/plain" });
  Object.defineProperty(file, "text", {
    value: vi.fn(() => Promise.resolve(content)),
  });
  return file;
}

describe("useAgentAttachments concurrent work", () => {
  it("preserves a completed upload while another text file is being read", async () => {
    const uploaded = deferred<{ id: string }>();
    const read = deferred<string>();
    mocks.upload.mockReturnValue(uploaded.promise);
    const { result } = renderHook(() => useAgentAttachments("workspace"));
    let image!: Promise<void>;
    act(() => {
      image = result.current.add([
        new File(["png"], "image.png", { type: "image/png" }),
      ]);
    });
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
    let notes!: Promise<void>;
    const file = textFile("notes.md", read.promise);
    act(() => {
      notes = result.current.add([file]);
    });
    await waitFor(() => expect(file.text).toHaveBeenCalledOnce());
    await act(async () => {
      uploaded.resolve({ id: "stored-image" });
      await image;
    });
    expect(result.current.items[0]).toMatchObject({
      kind: "file",
      id: "stored-image",
    });
    await act(async () => {
      read.resolve("Current notes");
      await notes;
    });
    expect(result.current.toRunInput()).toEqual([
      { id: "stored-image" },
      { name: "notes.md", content: "Current notes" },
    ]);
    expect(result.current.uploading).toBe(false);
  });

  it("does not resurrect a removed attachment after a slow read", async () => {
    const read = deferred<string>();
    const { result } = renderHook(() => useAgentAttachments("workspace"));
    await act(async () => {
      await result.current.add([textFile("old.md", "Old notes")]);
    });
    const oldKey = result.current.items[0]!.key;
    let addition!: Promise<void>;
    const file = textFile("new.md", read.promise);
    act(() => {
      addition = result.current.add([file]);
    });
    await waitFor(() => expect(file.text).toHaveBeenCalledOnce());
    act(() => result.current.remove(oldKey));
    await act(async () => {
      read.resolve("New notes");
      await addition;
    });
    expect(result.current.toRunInput()).toEqual([
      { name: "new.md", content: "New notes" },
    ]);
  });

  it("clear cancels old reads and lets a fresh selection finish immediately", async () => {
    const read = deferred<string>();
    const { result } = renderHook(() => useAgentAttachments("workspace"));
    let old!: Promise<void>;
    const file = textFile("old.md", read.promise);
    act(() => {
      old = result.current.add([file]);
    });
    await waitFor(() => expect(file.text).toHaveBeenCalledOnce());
    expect(result.current.uploading).toBe(true);
    act(() => result.current.clear());
    await act(async () => {
      await result.current.add([textFile("new.md", "New notes")]);
    });
    await act(async () => {
      read.resolve("Old notes");
      await old;
    });
    expect(result.current.toRunInput()).toEqual([
      { name: "new.md", content: "New notes" },
    ]);
    expect(result.current.uploading).toBe(false);
  });

  it("keeps same-name replacements in selection order", async () => {
    const read = deferred<string>();
    const { result } = renderHook(() => useAgentAttachments("workspace"));
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.add([textFile("notes.md", read.promise)]);
      second = result.current.add([textFile("notes.md", "Latest selection")]);
    });
    await act(async () => {
      read.resolve("Earlier selection");
      await Promise.all([first, second]);
    });
    expect(result.current.toRunInput()).toEqual([
      { name: "notes.md", content: "Latest selection" },
    ]);
  });

  it("enforces the file limit across concurrent selections without dropping accepted files", async () => {
    const { result } = renderHook(() => useAgentAttachments("workspace"));
    await act(async () => {
      await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          result.current.add([textFile(`${i}.md`, String(i))]),
        ),
      );
    });
    expect(result.current.items.map((item) => item.name)).toEqual([
      "0.md",
      "1.md",
      "2.md",
      "3.md",
      "4.md",
    ]);
    expect(mocks.error).toHaveBeenCalledWith(
      "agent:composer.attachmentErrors.tooMany",
    );
    expect(result.current.uploading).toBe(false);
  });

  it("enforces the total text limit across concurrent selections", async () => {
    const { result } = renderHook(() => useAgentAttachments("workspace"));
    await act(async () => {
      await Promise.all(
        ["a", "b", "c"].map((name) =>
          result.current.add([textFile(`${name}.md`, name.repeat(50000))]),
        ),
      );
    });
    expect(result.current.items).toHaveLength(2);
    expect(mocks.error).toHaveBeenCalledWith(
      "agent:composer.attachmentErrors.tooLarge",
    );
  });

  it("uses capacity freed by a removal during an in-progress read", async () => {
    const read = deferred<string>();
    const { result } = renderHook(() => useAgentAttachments("workspace"));
    await act(async () => {
      await result.current.add([
        textFile("a.md", "a".repeat(50000)),
        textFile("b.md", "b".repeat(50000)),
      ]);
    });
    let addition!: Promise<void>;
    const file = textFile("c.md", read.promise);
    act(() => {
      addition = result.current.add([file]);
    });
    await waitFor(() => expect(file.text).toHaveBeenCalledOnce());
    act(() => result.current.remove(result.current.items[0]!.key));
    await act(async () => {
      read.resolve("c".repeat(50000));
      await addition;
    });
    expect(result.current.items.map((item) => item.name)).toEqual([
      "b.md",
      "c.md",
    ]);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("does not let an old upload restore a removed draft", async () => {
    const uploaded = deferred<{ id: string }>();
    mocks.upload.mockReturnValue(uploaded.promise);
    const { result } = renderHook(() => useAgentAttachments("workspace"));
    let addition!: Promise<void>;
    act(() => {
      addition = result.current.add([
        new File(["png"], "image.png", { type: "image/png" }),
      ]);
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.remove(result.current.items[0]!.key));
    await act(async () => {
      uploaded.resolve({ id: "stored" });
      await addition;
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.uploading).toBe(false);
  });
});
