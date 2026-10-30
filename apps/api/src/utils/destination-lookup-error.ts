export class DestinationLookupError extends Error {
  readonly code = "ENOTFOUND";

  constructor(label: string) {
    super(`${label} destination could not be resolved`);
  }
}
