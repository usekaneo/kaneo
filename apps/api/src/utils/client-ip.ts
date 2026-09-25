import { BlockList, isIP } from "node:net";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { MiddlewareHandler } from "hono";

const CLIENT_IP_HEADER = "x-kaneo-client-ip";
const DEFAULT_TRUSTED_PROXIES = "127.0.0.0/8,::1/128";

export function createClientIpResolver(config = process.env.TRUSTED_PROXIES) {
  const trusted = new BlockList();
  const raw = config?.trim() || DEFAULT_TRUSTED_PROXIES;
  for (const entry of raw === "none" ? [] : raw.split(",")) {
    const parts = entry.trim().split("/");
    const [address = "", prefix] = parts;
    const family = isIP(address);
    const bits = family === 4 ? 32 : 128;
    if (
      !family ||
      parts.length > 2 ||
      (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) > bits))
    ) {
      throw new Error(
        "TRUSTED_PROXIES must contain valid IP addresses or CIDR ranges, or 'none'",
      );
    }
    if (prefix === undefined)
      trusted.addAddress(address, family === 4 ? "ipv4" : "ipv6");
    else
      trusted.addSubnet(
        address,
        Number(prefix),
        family === 4 ? "ipv4" : "ipv6",
      );
  }
  const isTrusted = (address: string) =>
    trusted.check(address, isIP(address) === 4 ? "ipv4" : "ipv6");

  return (
    peer: string | undefined,
    forwarded: string | undefined,
  ): string | null => {
    if (!peer || !isIP(peer)) return null;
    if (!isTrusted(peer) || !forwarded || forwarded.length > 8192) return peer;
    const hops = forwarded.split(",");
    if (hops.length > 64) return peer;
    let current = peer;
    for (let i = hops.length - 1; i >= 0; i--) {
      if (!isTrusted(current)) break;
      const candidate = hops[i]?.trim() ?? "";
      // A malformed chain has no reliable client identity; keep the transport peer.
      if (!isIP(candidate)) return peer;
      current = candidate;
    }
    return current;
  };
}

export function clientIpMiddleware(config?: string): MiddlewareHandler {
  const resolve = createClientIpResolver(config);
  return async (c, next) => {
    let peer: string | undefined;
    // app.request() and non-Node adapters have no socket. Do not trust headers
    // in that case: Better Auth uses its shared fallback rate-limit bucket.
    try {
      peer = getConnInfo(c).remote.address;
    } catch {
      /* no transport peer */
    }
    const ip = resolve(peer, c.req.header("x-forwarded-for"));
    const headers = new Headers(c.req.raw.headers);
    headers.delete(CLIENT_IP_HEADER);
    if (ip) headers.set(CLIENT_IP_HEADER, ip);
    c.req.raw = new Request(c.req.raw, { headers });
    await next();
  };
}
