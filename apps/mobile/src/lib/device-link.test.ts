import { describe, expect, it } from "vite-plus/test";
import { reachableDeviceLink } from "./device-link";

describe("reachableDeviceLink", () => {
  it("points a localhost link at the server the app connected to", () => {
    expect(
      reachableDeviceLink(
        "http://localhost/device?user_code=ABCD",
        "http://192.168.1.20:1337",
      ),
    ).toBe("http://192.168.1.20:1337/device?user_code=ABCD");
    expect(
      reachableDeviceLink(
        "http://127.0.0.1:5173/device",
        "https://kaneo.example.com",
      ),
    ).toBe("https://kaneo.example.com/device");
    expect(
      reachableDeviceLink("http://[::1]:5173/device", "http://10.0.0.2"),
    ).toBe("http://10.0.0.2/device");
  });

  it("keeps links that are already reachable", () => {
    const link = "https://cloud.kaneo.app/device?user_code=ABCD";
    expect(reachableDeviceLink(link, "https://cloud.kaneo.app")).toBe(link);
    expect(reachableDeviceLink(link, "http://localhost:1337")).toBe(link);
  });

  it("keeps a localhost link when the app also talks to localhost", () => {
    const link = "http://localhost:5173/device";
    expect(reachableDeviceLink(link, "http://localhost:1337")).toBe(link);
  });
});
