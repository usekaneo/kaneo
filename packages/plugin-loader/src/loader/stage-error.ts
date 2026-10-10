export class StageError extends Error {
  readonly hint: string | null;

  constructor(message: string, hint: string | null = null) {
    super(message);
    this.name = "StageError";
    this.hint = hint;
  }
}
