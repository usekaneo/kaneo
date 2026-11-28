import dns from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import type { ResolveAll } from "../../import/destination-lookup";
import { isDisallowedAddress } from "../../utils/assert-public-destination";

function isPublicAddress(address: string): boolean {
  if (isDisallowedAddress(address)) return false;
  if (isIP(address) === 4) {
    const [first, second, third] = address.split(".").map(Number);
    return !(
      first === undefined ||
      second === undefined ||
      third === undefined ||
      first >= 224 ||
      (first === 192 &&
        ((second === 0 && (third === 0 || third === 2)) ||
          (second === 88 && third === 99))) ||
      (first === 198 &&
        (second === 18 || second === 19 || (second === 51 && third === 100))) ||
      (first === 203 && second === 0 && third === 113)
    );
  }
  if (isIP(address) === 6) {
    const normalized = new URL(`https://[${address}]`).hostname.slice(1, -1);
    const [first = "", second = "0"] = normalized.split(":");
    const prefix = Number.parseInt(first, 16);
    const subnet = Number.parseInt(second || "0", 16);
    // Fail closed on transition, documentation, and special-purpose prefixes.
    return (
      prefix >= 0x2000 &&
      prefix < 0x3fff &&
      prefix !== 0x2002 &&
      !(prefix === 0x2001 && (subnet < 0x200 || subnet === 0xdb8))
    );
  }
  return false;
}

export function createTangledLookup(
  resolve: ResolveAll = dns.lookup,
): LookupFunction {
  return (hostname, options, callback) => {
    // Validate all families before selecting a socket address, not just the preferred family.
    resolve(
      hostname,
      { all: true, verbatim: true, family: 0 },
      (error, addresses) => {
        if (error) return callback(error, []);
        if (addresses.some(({ address }) => !isPublicAddress(address))) {
          return callback(
            Object.assign(new Error("Tangled API destination is not public"), {
              code: "EACCES",
            }),
            [],
          );
        }
        const eligible = options.family
          ? addresses.filter((entry) => entry.family === options.family)
          : addresses;
        const first = eligible[0];
        if (!first) {
          return callback(
            Object.assign(
              new Error("Tangled API destination could not be resolved"),
              { code: "ENOTFOUND" },
            ),
            [],
          );
        }
        if (options.all) return callback(null, eligible);
        callback(null, first.address, first.family);
      },
    );
  };
}
