export class DestinationLookupError extends Error {
  constructor() {
    super("Destination could not be resolved");
  }
}
