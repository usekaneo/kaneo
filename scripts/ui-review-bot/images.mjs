import { lstat, readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { PNG } from "pngjs";

export const MAX_IMAGE_BYTES = 6_000_000;

export function decodeScreenshot(bytes, { preview = false } = {}) {
  const invalid = () =>
    new Error("Invalid screenshot: expected a bounded PNG within 1440 × 1000.");
  if (
    bytes.length < 45 ||
    bytes.length > MAX_IMAGE_BYTES ||
    bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
  )
    throw invalid();
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (
    preview
      ? width < 320 || height < 160 || width > 1440 || height > 1000
      : width !== 1440 || height !== 1000
  )
    throw invalid();
  const chunks = [bytes.subarray(0, 8)];
  const compressed = [];
  let ended = false;
  let channels;
  let count = 0;
  for (let offset = 8; offset < bytes.length; ) {
    if (++count > 1024 || offset + 12 > bytes.length || ended) throw invalid();
    const length = bytes.readUInt32BE(offset);
    const end = offset + length + 12;
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (end > bytes.length || !/^[A-Za-z]{4}$/.test(type)) throw invalid();
    if (offset === 8 && type !== "IHDR") throw invalid();
    if (type === "IHDR") {
      if (
        offset !== 8 ||
        length !== 13 ||
        bytes[24] !== 8 ||
        ![2, 6].includes(bytes[25]) ||
        bytes[26] !== 0 ||
        bytes[27] !== 0 ||
        bytes[28] !== 0
      )
        throw invalid();
      channels = bytes[25] === 6 ? 4 : 3;
      chunks.push(bytes.subarray(offset, end));
    } else if (type === "IDAT") {
      compressed.push(bytes.subarray(offset + 8, end - 4));
      chunks.push(bytes.subarray(offset, end));
    } else if (type === "IEND") {
      if (length !== 0 || end !== bytes.length || !compressed.length)
        throw invalid();
      chunks.push(bytes.subarray(offset, end));
      ended = true;
    } else if (type[0] === type[0].toUpperCase()) throw invalid();
    offset = end;
  }
  if (!ended) throw invalid();
  // Reject duplicate headers and expansion bombs before pngjs parses untrusted bytes.
  const expected = (width * channels + 1) * height;
  try {
    if (
      inflateSync(Buffer.concat(compressed), { maxOutputLength: expected })
        .length !== expected
    )
      throw invalid();
    return PNG.sync.read(Buffer.concat(chunks));
  } catch {
    throw invalid();
  }
}

export async function readScreenshot(file, options) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_IMAGE_BYTES)
    throw new Error("Invalid screenshot file.");
  return decodeScreenshot(await readFile(file), options);
}
