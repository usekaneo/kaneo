import { Data } from "effect";

export class CatalogUnreadable extends Data.TaggedError("CatalogUnreadable") {}

export class CheckFailed extends Data.TaggedError("CheckFailed") {}
