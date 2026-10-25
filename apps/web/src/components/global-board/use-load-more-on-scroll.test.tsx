import { act, cleanup, render } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useLoadMoreOnScroll } from "./use-load-more-on-scroll";

let report: (isIntersecting: boolean) => void = () => {};

class FakeObserver {
  constructor(callback: IntersectionObserverCallback) {
    report = (isIntersecting) =>
      callback(
        [{ isIntersecting } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
  }
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Query = Parameters<typeof useLoadMoreOnScroll>[0];

function Lane(query: Query) {
  const ref = useLoadMoreOnScroll(query);
  return (
    <div>
      <span ref={ref} />
    </div>
  );
}

const idle = { hasNextPage: true, isFetchingNextPage: false, isError: false };

describe("useLoadMoreOnScroll", () => {
  it("fetches when the sentinel nears the end, and again after each page", () => {
    const fetchNextPage = vi.fn();
    const view = render(<Lane {...idle} fetchNextPage={fetchNextPage} />);
    expect(fetchNextPage).not.toHaveBeenCalled();

    act(() => report(true));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    view.rerender(
      <Lane {...idle} isFetchingNextPage fetchNextPage={fetchNextPage} />,
    );
    view.rerender(<Lane {...idle} fetchNextPage={fetchNextPage} />);
    expect(fetchNextPage).toHaveBeenCalledTimes(2);
  });

  it("stops on the last page or after an error", () => {
    const fetchNextPage = vi.fn();
    const view = render(
      <Lane {...idle} hasNextPage={false} fetchNextPage={fetchNextPage} />,
    );
    act(() => report(true));
    view.rerender(<Lane {...idle} isError fetchNextPage={fetchNextPage} />);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });
});
