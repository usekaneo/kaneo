import { describe, it, expect } from "vite-plus/test";
import Quackback, { type InitOptions } from "../src";

describe("public API", () => {
  it("exports the expected surface", () => {
    expect(typeof Quackback.init).toBe("function");
    expect(typeof Quackback.identify).toBe("function");
    expect(typeof Quackback.logout).toBe("function");
    expect(typeof Quackback.open).toBe("function");
    expect(typeof Quackback.close).toBe("function");
    expect(typeof Quackback.showLauncher).toBe("function");
    expect(typeof Quackback.hideLauncher).toBe("function");
    expect(typeof Quackback.isOpen).toBe("function");
    expect(typeof Quackback.getUser).toBe("function");
    expect(typeof Quackback.isIdentified).toBe("function");
    expect(typeof Quackback.on).toBe("function");
    expect(typeof Quackback.off).toBe("function");
    expect(typeof Quackback.metadata).toBe("function");
    expect(typeof Quackback.destroy).toBe("function");
    expect(typeof Quackback.version).toBe("string");
  });

  it("init throws when instanceUrl is missing", () => {
    expect(() => Quackback.init({} as InitOptions)).toThrow(/instanceUrl/);
  });
});
