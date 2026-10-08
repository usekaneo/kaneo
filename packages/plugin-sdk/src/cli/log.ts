import { styleText } from "node:util";

export const log = {
  info(message: string) {
    console.log(message);
  },
  step(message: string) {
    console.log(styleText("dim", message));
  },
  success(message: string) {
    console.log(styleText("green", message));
  },
  warn(message: string) {
    console.warn(styleText("yellow", `warning: ${message}`));
  },
  error(message: string) {
    console.error(styleText("red", `error: ${message}`));
  },
};
