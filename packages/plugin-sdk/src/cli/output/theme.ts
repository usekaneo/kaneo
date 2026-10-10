import { styleText } from "node:util";

export type Theme = {
  readonly color: boolean;
  readonly dim: (text: string) => string;
  readonly success: (text: string) => string;
  readonly warning: (text: string) => string;
  readonly danger: (text: string) => string;
};

type Format = "dim" | "green" | "yellow" | "red";

export function makeTheme(color: boolean): Theme {
  const style = (format: Format) => (text: string) =>
    color ? styleText(format, text, { validateStream: false }) : text;
  return {
    color,
    dim: style("dim"),
    success: style("green"),
    warning: style("yellow"),
    danger: style("red"),
  };
}
