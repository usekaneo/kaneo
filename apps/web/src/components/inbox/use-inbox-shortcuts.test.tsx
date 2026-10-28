import { act, cleanup, fireEvent, render } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { shortcutRegistry } from "@/lib/shortcuts/registry";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import type { Notification } from "@/types/notification";
import { useInboxShortcuts } from "./use-inbox-shortcuts";

const mocks = vi.hoisted(() => ({
  markAsRead: vi.fn(),
  markAsUnread: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  clearRead: vi.fn(),
  message: vi.fn(),
  error: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/mutations/notification/use-mark-notification-as-read", () => ({
  default: () => ({ mutate: mocks.markAsRead }),
}));
vi.mock(
  "@/hooks/mutations/notification/use-mark-notification-as-unread",
  () => ({ default: () => ({ mutate: mocks.markAsUnread }) }),
);
vi.mock(
  "@/hooks/mutations/notification/use-mark-all-notifications-as-read",
  () => ({ default: () => ({ mutate: mocks.markAllAsRead }) }),
);
vi.mock("@/hooks/mutations/notification/use-delete-notification", () => ({
  default: () => ({ mutateAsync: mocks.deleteNotification }),
}));
vi.mock("@/hooks/mutations/notification/use-clear-read-notifications", () => ({
  default: () => ({ mutateAsync: mocks.clearRead }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { message: mocks.message, error: mocks.error },
}));

const notification = (id: string, isRead: boolean) =>
  ({ id, isRead }) as unknown as Notification;

const order = [
  notification("a", true),
  notification("b", false),
  notification("c", true),
];

function Harness({
  selectedId,
  onSelect,
}: {
  selectedId?: string;
  onSelect: (notification: Notification) => void;
}) {
  useInboxShortcuts({
    workspaceId: "workspace-1",
    notifications: order,
    order,
    selectedId,
    onSelect,
  });
  return null;
}

function renderInbox(selectedId?: string) {
  const onSelect = vi.fn();
  render(
    <ShortcutTestWrapper>
      <Harness selectedId={selectedId} onSelect={onSelect} />
    </ShortcutTestWrapper>,
  );
  return onSelect;
}

const press = (init: KeyboardEventInit) =>
  fireEvent.keyDown(document.body, init);

beforeEach(() => {
  mocks.deleteNotification.mockResolvedValue({ success: true });
  mocks.clearRead.mockResolvedValue({ success: true });
});

afterEach(() => {
  cleanup();
  shortcutRegistry.reset();
  vi.clearAllMocks();
});

describe("useInboxShortcuts", () => {
  it("moves through notifications with J and K", () => {
    const onSelect = renderInbox("b");

    press({ key: "j", code: "KeyJ" });
    press({ key: "ArrowUp", code: "ArrowUp" });

    expect(onSelect.mock.calls.map(([item]) => item.id)).toEqual(["c", "a"]);
  });

  it("starts at the top when nothing is selected", () => {
    const onSelect = renderInbox();

    press({ key: "j", code: "KeyJ" });

    expect(onSelect).toHaveBeenCalledWith(order[0]);
  });

  it("toggles the read state of the selected notification", () => {
    renderInbox("a");
    press({ key: "u", code: "KeyU" });
    expect(mocks.markAsUnread).toHaveBeenCalledWith("a");

    cleanup();
    shortcutRegistry.reset();
    renderInbox("b");
    press({ key: "u", code: "KeyU" });
    expect(mocks.markAsRead).toHaveBeenCalledWith("b");
  });

  it("marks everything read with Alt+U", () => {
    renderInbox();

    press({ key: "u", code: "KeyU", altKey: true });

    expect(mocks.markAllAsRead).toHaveBeenCalledTimes(1);
  });

  it("deletes the selected notification and selects the next one", async () => {
    const onSelect = renderInbox("b");

    press({ key: "Backspace", code: "Backspace" });
    await act(async () => {});

    expect(mocks.deleteNotification).toHaveBeenCalledWith("b");
    expect(onSelect).toHaveBeenCalledWith(order[2]);
  });

  it("deletes all read notifications with Shift+Backspace", async () => {
    renderInbox();

    press({ key: "Backspace", code: "Backspace", shiftKey: true });
    await act(async () => {});

    expect(mocks.clearRead).toHaveBeenCalledTimes(1);
    expect(mocks.message).toHaveBeenCalledWith(
      "notifications:inbox.readCleared",
      { icon: expect.anything() },
    );
  });

  it("reports a failed delete", async () => {
    mocks.deleteNotification.mockRejectedValue(new Error("Gone"));
    renderInbox("a");

    press({ key: "e", code: "KeyE" });
    await act(async () => {});

    expect(mocks.error).toHaveBeenCalledWith("notifications:inbox.actionError");
  });
});
