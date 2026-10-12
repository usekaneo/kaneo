import { describe, expect, it } from "vite-plus/test";
import {
  parseTimerPointers,
  serializeTimerPointers,
  withTimerPointer,
} from "./timer-pointers.js";

describe("timer pointers", () => {
  it("round-trips through the file format", () => {
    const pointers = withTimerPointer({}, "https://kaneo.test", {
      entryId: "e1",
      taskId: "t1",
    });
    expect(parseTimerPointers(serializeTimerPointers(pointers))).toEqual({
      "https://kaneo.test": { entryId: "e1", taskId: "t1" },
    });
  });

  it("keeps one pointer per server and clears it", () => {
    const first = withTimerPointer({}, "https://a.test", {
      entryId: "e1",
      taskId: "t1",
    });
    const both = withTimerPointer(first, "https://b.test", {
      entryId: "e2",
      taskId: "t2",
    });
    expect(withTimerPointer(both, "https://a.test", null)).toEqual({
      "https://b.test": { entryId: "e2", taskId: "t2" },
    });
  });

  it("ignores broken or foreign content", () => {
    expect(parseTimerPointers("not json")).toEqual({});
    expect(parseTimerPointers('{"timers":[1]}')).toEqual({});
    expect(
      parseTimerPointers('{"timers":{"https://a.test":{"entryId":1}}}'),
    ).toEqual({});
  });
});
