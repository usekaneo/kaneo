import { describe, expect, it } from "vite-plus/test";
import {
  parsePresignedUrlOrigin,
  withPresignedUrlOrigin,
} from "../../../apps/api/src/storage/presigned-url-origin";

describe("parsePresignedUrlOrigin", () => {
  it("returns the origin, or nothing when unset", () => {
    expect(parsePresignedUrlOrigin("")).toBeUndefined();
    expect(parsePresignedUrlOrigin("https://Kaneo.Example.com/")).toBe(
      "https://kaneo.example.com",
    );
    expect(parsePresignedUrlOrigin("http://localhost:5173")).toBe(
      "http://localhost:5173",
    );
  });

  it.each([
    "kaneo.example.com",
    "ftp://kaneo.example.com",
    "https://kaneo.example.com/uploads",
    "https://kaneo.example.com/?a=1",
    "https://kaneo.example.com/#top",
    "https://user:pass@kaneo.example.com",
  ])("rejects %s", (value) => {
    expect(() => parsePresignedUrlOrigin(value)).toThrow(
      "S3_PRESIGNED_URL_ORIGIN must be an origin",
    );
  });
});

describe("withPresignedUrlOrigin", () => {
  const signed =
    "https://s3.example.test:9000/kaneo/workspace/w1/a%20b.png?X-Amz-Signature=abc&X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost";

  it("keeps the URL when no origin is set", () => {
    expect(withPresignedUrlOrigin(signed, undefined)).toBe(signed);
  });

  it("refuses a value that is not an origin", () => {
    expect(() =>
      withPresignedUrlOrigin(signed, "https://kaneo.example.com/uploads"),
    ).toThrow("S3_PRESIGNED_URL_ORIGIN must be an origin");
  });

  it("replaces only the origin and keeps the signed path and query", () => {
    expect(withPresignedUrlOrigin(signed, "https://Kaneo.Example.com/")).toBe(
      "https://kaneo.example.com/kaneo/workspace/w1/a%20b.png?X-Amz-Signature=abc&X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost",
    );
  });
});
