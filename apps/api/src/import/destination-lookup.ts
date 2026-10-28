import dns, { type LookupAddress, type LookupAllOptions } from "node:dns";
import type { LookupFunction } from "node:net";
import {
  isDisallowedAddress,
  privateDestinationsAllowed,
} from "../utils/assert-public-destination";
import { blockedDestinationError } from "./blocked-destination-error";

export type ResolveAll = (
  hostname: string,
  options: LookupAllOptions,
  callback: (
    error: NodeJS.ErrnoException | null,
    addresses: LookupAddress[],
  ) => void,
) => void;

function notFound(hostname: string) {
  return Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), {
    code: "ENOTFOUND",
    hostname,
  });
}

export function createDestinationLookup(
  resolve: ResolveAll = dns.lookup,
): LookupFunction {
  return (hostname, options, callback) => {
    resolve(
      hostname,
      {
        family: options.family,
        hints: options.hints,
        all: true,
        verbatim: true,
      },
      (error, addresses) => {
        if (error) return callback(error, []);
        const blocked =
          !privateDestinationsAllowed() &&
          addresses.some(({ address }) => isDisallowedAddress(address));
        if (blocked) return callback(blockedDestinationError(), []);

        const [first] = addresses;
        if (!first) return callback(notFound(hostname), []);
        if (options.all) return callback(null, addresses);
        callback(null, first.address, first.family);
      },
    );
  };
}
