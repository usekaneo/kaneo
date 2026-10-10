// Titles stay single-line text even when edited in a wrapping textarea.
export function stripLineBreaks(value: string) {
  return value.replace(/\s*[\r\n]+\s*/g, " ");
}
