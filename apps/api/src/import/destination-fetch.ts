import type { FetchLike } from "@kaneo/importers";
import { Agent, fetch, type RequestInit as UndiciRequestInit } from "undici";
import { createDestinationLookup } from "./destination-lookup";

const agent = new Agent({ connect: { lookup: createDestinationLookup() } });

export const destinationFetch: FetchLike = async (input, init) => {
  const response = await fetch(input, {
    ...(init as UndiciRequestInit),
    dispatcher: agent,
  });
  return response as unknown as Response;
};
