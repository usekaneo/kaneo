import { describe, expect, it } from "vite-plus/test";
import { decodeAgentUpload, InvalidAgentUploadError } from "./decode-upload";

const encode = (value: string) =>
  Buffer.from(value, "latin1").toString("base64");

describe("decodeAgentUpload", () => {
  it.each([
    ["image/png", "\x89PNG\r\n\x1a\nrest"],
    ["image/jpeg", "\xff\xd8\xff\xe0rest"],
    ["image/webp", "RIFF\x00\x00\x00\x00WEBPVP8 "],
    ["image/gif", "GIF89a rest"],
    ["image/gif", "GIF87a rest"],
    ["application/pdf", "%PDF-1.7\n"],
  ] as const)("accepts %s with a matching signature", (mediaType, content) => {
    expect(decodeAgentUpload(mediaType, encode(content))).toEqual(
      Buffer.from(content, "latin1"),
    );
  });

  it("rejects bytes that do not match the declared type", () => {
    expect(() => decodeAgentUpload("image/png", encode("%PDF-1.7\n"))).toThrow(
      InvalidAgentUploadError,
    );
    expect(() =>
      decodeAgentUpload("application/pdf", encode("<html>")),
    ).toThrow(InvalidAgentUploadError);
  });

  it("rejects malformed base64 and oversized files", () => {
    expect(() => decodeAgentUpload("image/gif", "R0lG*DlhAQ==")).toThrow(
      "base64",
    );
    expect(() => decodeAgentUpload("image/gif", "R0lGODlh")).not.toThrow();
    expect(() =>
      decodeAgentUpload(
        "image/gif",
        encode(`GIF89a${"x".repeat(5 * 1024 * 1024)}`),
      ),
    ).toThrow("too large");
  });
});
