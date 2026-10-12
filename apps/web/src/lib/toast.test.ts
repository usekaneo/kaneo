import { afterEach, expect, it, vi } from "vite-plus/test";
import { toastManager } from "@/components/ui/toast";
import { toast } from "./toast";

afterEach(() => vi.restoreAllMocks());

it("reuses one toast for repeats and marks each repeat", () => {
  const add = vi
    .spyOn(toastManager, "add")
    .mockImplementation((options) => options.id ?? "");

  const first = toast.success("Link copied");
  const second = toast.success("Link copied");
  const other = toast.error("Link copied");

  expect(first).toBe(second);
  expect(other).not.toBe(first);
  const [a, b] = add.mock.calls.map(([options]) => options);
  expect(a.id).toBe(b.id);
  expect((b.data as { repeat: number }).repeat).toBeGreaterThan(
    (a.data as { repeat: number }).repeat,
  );
});
