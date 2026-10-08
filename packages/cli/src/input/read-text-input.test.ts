import { describe, expect, it } from "vite-plus/test";
import { stripByteOrderMark } from "./read-text-input.js";

describe("stripByteOrderMark", () => {
  it("removes a leading byte order mark only", () => {
    expect(stripByteOrderMark("﻿hello")).toBe("hello");
    expect(stripByteOrderMark("hello﻿")).toBe("hello﻿");
  });
});
