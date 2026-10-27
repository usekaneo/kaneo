import { lookup } from "node:dns/promises";
import net from "node:net";
import { DestinationLookupError } from "./destination-lookup-error";

function isDisallowedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return true;
  }

  const [a, b] = parts as [number, number, number, number];

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    // 100.64.0.0/10, RFC 6598. Several hosted Kubernetes offerings put pod
    // and service networks in here, where it reaches the same neighbours
    // 10/8 does on a plain VPC.
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

// ::ffff:127.0.0.1 is an IPv4 destination wearing an IPv6 shape, and the URL
// parser rewrites it to the hex form ::ffff:7f00:1, so both must be unwrapped.
function mappedIpv4(ip: string): string | null {
  const dotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted?.[1]) return dotted[1];

  const hex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex?.[1] || !hex[2]) return null;

  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

function isDisallowedIpv6(ip: string): boolean {
  // DNS can return expanded/dotted spellings too. Use one canonical spelling
  // before matching prefixes or extracting IPv4 transition destinations.
  let normalized: string;
  try {
    normalized = new URL(`http://[${ip}]`).hostname.slice(1, -1);
  } catch {
    return true;
  }

  const mapped = mappedIpv4(normalized);
  if (mapped) {
    return isDisallowedIpv4(mapped);
  }

  const [head, tail] = normalized.split("::");
  const start = head ? head.split(":") : [];
  const end = tail ? tail.split(":") : [];
  const words = [
    ...start,
    ...Array<string>(8 - start.length - end.length).fill("0"),
    ...end,
  ].map((word) => Number.parseInt(word, 16));
  const ipv4 = (high: number, low: number) =>
    `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
  const embedded = (high: number, low: number) =>
    isDisallowedIpv4(ipv4(high, low));

  // RFC 3056 (6to4), RFC 6052 (NAT64), RFC 4291 (IPv4-compatible),
  // and RFC 4380 (Teredo) can route a global-looking IPv6 address to IPv4.
  if (words[0] === 0x2002) return embedded(words[1]!, words[2]!);
  if (words.slice(0, 6).every((word) => word === 0)) {
    return embedded(words[6]!, words[7]!);
  }
  if (
    words.slice(0, 4).every((word) => word === 0) &&
    words[4] === 0xffff &&
    words[5] === 0
  ) {
    return embedded(words[6]!, words[7]!);
  }
  if (
    words[0] === 0x64 &&
    words[1] === 0xff9b &&
    words.slice(2, 6).every((word) => word === 0)
  ) {
    return embedded(words[6]!, words[7]!);
  }
  if (words[0] === 0x2001 && words[1] === 0) {
    return (
      embedded(words[2]!, words[3]!) ||
      embedded(words[6]! ^ 0xffff, words[7]! ^ 0xffff)
    );
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    // RFC 8215 reserves this prefix for network-local translation.
    (words[0] === 0x64 && words[1] === 0xff9b && words[2] === 1) ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  );
}

export function isDisallowedAddress(address: string): boolean {
  // URL.hostname keeps the brackets on IPv6 literals, and net.isIP rejects
  // those, which would let http://[::1] slip past the checks below.
  const bare = address.replace(/^\[|\]$/g, "");

  if (bare === "localhost") {
    return true;
  }

  const version = net.isIP(bare);
  if (version === 4) {
    return isDisallowedIpv4(bare);
  }

  if (version === 6) {
    return isDisallowedIpv6(bare);
  }

  return false;
}

export function privateDestinationsAllowed(): boolean {
  return (
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS === "true" ||
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS === "1"
  );
}

export function nonRoutableDestinationMessage(label: string): string {
  return `${label} destination resolves to a non-routable address`;
}

export async function assertPublicDestination(
  destinationUrl: string,
  label: string,
): Promise<void> {
  const url = new URL(destinationUrl);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${label} URL must use http or https`);
  }

  if (privateDestinationsAllowed()) {
    return;
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isDisallowedAddress(hostname)) {
    throw new Error(nonRoutableDestinationMessage(label));
  }

  // Literal addresses do not use the socket's DNS lookup callback. Validate
  // them here, and avoid looking up bracketed IPv6 literals as hostnames.
  if (net.isIP(hostname)) return;

  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(
    () => {
      throw new DestinationLookupError();
    },
  );
  if (addresses.length === 0) {
    throw new DestinationLookupError();
  }

  if (addresses.some((entry) => isDisallowedAddress(entry.address))) {
    throw new Error(nonRoutableDestinationMessage(label));
  }
}
