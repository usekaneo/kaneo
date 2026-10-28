import { AGENT_ATTACHMENT_LIMITS, AGENT_UPLOAD_MEDIA_TYPES } from "./schema";

export type AgentUploadMediaType = (typeof AGENT_UPLOAD_MEDIA_TYPES)[number];

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function startsWith(bytes: Buffer, signature: string, offset = 0) {
  return (
    bytes.length >= offset + signature.length &&
    bytes.subarray(offset, offset + signature.length).toString("latin1") ===
      signature
  );
}

// Declared types are checked against the bytes so a renamed file cannot reach
// the model or the content endpoint under another type.
function hasSignature(mediaType: AgentUploadMediaType, bytes: Buffer) {
  switch (mediaType) {
    case "image/png":
      return startsWith(bytes, "\x89PNG\r\n\x1a\n");
    case "image/jpeg":
      return startsWith(bytes, "\xff\xd8\xff");
    case "image/webp":
      return startsWith(bytes, "RIFF") && startsWith(bytes, "WEBP", 8);
    case "image/gif":
      return startsWith(bytes, "GIF87a") || startsWith(bytes, "GIF89a");
    case "application/pdf":
      return startsWith(bytes, "%PDF-");
  }
}

export class InvalidAgentUploadError extends Error {}

export function decodeAgentUpload(
  mediaType: AgentUploadMediaType,
  data: string,
): Buffer {
  if (!BASE64_PATTERN.test(data) || data.length % 4 !== 0)
    throw new InvalidAgentUploadError("File data must be base64 encoded");
  const bytes = Buffer.from(data, "base64");
  if (bytes.length === 0)
    throw new InvalidAgentUploadError("File must not be empty");
  if (bytes.length > AGENT_ATTACHMENT_LIMITS.bytesPerUpload)
    throw new InvalidAgentUploadError("File is too large");
  if (!hasSignature(mediaType, bytes))
    throw new InvalidAgentUploadError(`File data does not match ${mediaType}`);
  return bytes;
}
