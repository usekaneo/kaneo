import { describe, expect, it } from "vite-plus/test";
import { readFileAsBase64 } from "./read-file-as-base64";

describe("readFileAsBase64", () => {
  it("returns only the base64 payload", async () => {
    const file = new File([new Uint8Array([0x47, 0x49, 0x46, 0xff])], "a.gif", {
      type: "image/gif",
    });
    expect(await readFileAsBase64(file)).toBe("R0lG/w==");
  });
});
