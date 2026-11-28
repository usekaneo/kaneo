import { Data } from "effect";

export class PackageJsonMissing extends Data.TaggedError("PackageJsonMissing")<{
  readonly root: string;
}> {}

export class PackageJsonInvalid extends Data.TaggedError("PackageJsonInvalid")<{
  readonly message: string;
}> {}

export class EntryMissing extends Data.TaggedError("EntryMissing")<{}> {}

export class ViteMissing extends Data.TaggedError("ViteMissing")<{}> {}

export class ViteUnloadable extends Data.TaggedError("ViteUnloadable")<{
  readonly detail: string;
}> {}

export class ViteTooOld extends Data.TaggedError("ViteTooOld")<{
  readonly version: string;
}> {}

export class TypesFailed extends Data.TaggedError("TypesFailed")<{
  readonly message: string;
}> {}

export class InvalidOutput extends Data.TaggedError("InvalidOutput")<{
  readonly problems: ReadonlyArray<string>;
}> {}

export class BuildFailed extends Data.TaggedError("BuildFailed")<{
  readonly message: string;
}> {}

export type BuildError =
  | PackageJsonMissing
  | PackageJsonInvalid
  | EntryMissing
  | ViteMissing
  | ViteUnloadable
  | ViteTooOld
  | TypesFailed
  | InvalidOutput
  | BuildFailed;
