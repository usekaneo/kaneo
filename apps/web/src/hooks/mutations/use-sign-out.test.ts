import { cleanup, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { handleUnauthorized } from "@/lib/http-error";
import { signOutState } from "@/lib/sign-out-state";
import useSignOut from "./use-sign-out";

const m = vi.hoisted(() => ({
  signOut: vi.fn(),
  getIdToken: vi.fn(),
  navigate: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  drain: vi.fn(),
  clear: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: ({ mutationFn }: { mutationFn: () => Promise<unknown> }) => ({
    mutateAsync: mutationFn,
  }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => m.navigate }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "user" } } }),
    signOut: m.signOut,
  },
}));
vi.mock("@/fetchers/oauth/get-id-token", () => ({ getIdToken: m.getIdToken }));
vi.mock("@/lib/description-save-queue", () => ({
  descriptionSaveQueue: { pause: m.pause, drain: m.drain, clear: m.clear },
}));
vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));

const location = {
  origin: "https://kaneo.example.test",
  pathname: "/dashboard",
  search: "",
  hash: "",
  href: "https://kaneo.example.test/dashboard",
  replace: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
  signOutState.isRedirecting = false;
  location.href = "https://kaneo.example.test/dashboard";
  vi.stubGlobal("window", { location });
  m.pause.mockReturnValue(m.resume);
  m.drain.mockResolvedValue(true);
  m.getIdToken.mockResolvedValue({ idToken: "test-id-token" });
  m.signOut.mockResolvedValue({ data: { success: true }, error: null });
});

afterEach(() => {
  cleanup();
  signOutState.isRedirecting = false;
  vi.unstubAllGlobals();
});

describe("custom OAuth sign-out", () => {
  it("protects the IdP navigation from 401s during and after local sign-out", async () => {
    m.getIdToken.mockImplementation(async () => {
      handleUnauthorized();
      return { idToken: "test-id-token" };
    });
    m.signOut.mockImplementation(async () => {
      expect(signOutState.isRedirecting).toBe(true);
      expect(m.getIdToken).toHaveBeenCalledTimes(1);
      handleUnauthorized();
      return { data: { success: true }, error: null };
    });

    const { result } = renderHook(() =>
      useSignOut("https://idp.example.test/logout?client_id=kaneo"),
    );
    await result.current.mutateAsync();
    // Cache cleanup and session listeners can still receive 401s until unload.
    handleUnauthorized();

    const url = new URL(location.href);
    expect(url.origin + url.pathname).toBe("https://idp.example.test/logout");
    expect(url.searchParams.get("client_id")).toBe("kaneo");
    expect(url.searchParams.get("id_token_hint")).toBe("test-id-token");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(
      "https://kaneo.example.test/auth/sign-in",
    );
    expect(location.replace).not.toHaveBeenCalled();
    expect(m.navigate).not.toHaveBeenCalled();
    expect(m.clear).toHaveBeenCalledTimes(1);
    expect(m.resume).toHaveBeenCalledTimes(1);
  });

  it("still logs out at the IdP when the ID token is unavailable", async () => {
    m.getIdToken.mockRejectedValue(new Error("Token unavailable"));

    const { result } = renderHook(() =>
      useSignOut("https://idp.example.test/logout"),
    );
    await result.current.mutateAsync();

    expect(m.signOut).toHaveBeenCalledTimes(1);
    expect(new URL(location.href).searchParams.has("id_token_hint")).toBe(
      false,
    );
    expect(signOutState.isRedirecting).toBe(true);
  });

  it.each(["response", "network"])(
    "restores ordinary unauthorized navigation after a %s failure",
    async (failure) => {
      if (failure === "response") {
        m.signOut.mockResolvedValue({ error: { message: "Sign-out failed" } });
      } else {
        m.signOut.mockRejectedValue(new Error("Sign-out failed"));
      }

      const { result } = renderHook(() =>
        useSignOut("https://idp.example.test/logout"),
      );
      await expect(result.current.mutateAsync()).rejects.toThrow(
        "Sign-out failed",
      );

      expect(signOutState.isRedirecting).toBe(false);
      expect(location.href).toBe("https://kaneo.example.test/dashboard");
      expect(m.clear).not.toHaveBeenCalled();
      expect(m.resume).toHaveBeenCalledTimes(1);
      handleUnauthorized();
      expect(location.replace).toHaveBeenCalledWith(
        "/auth/sign-in?redirect=%2Fdashboard",
      );
    },
  );

  it("keeps local-only sign-out and unauthorized navigation working", async () => {
    const { result } = renderHook(() => useSignOut());
    await result.current.mutateAsync();

    expect(m.getIdToken).not.toHaveBeenCalled();
    expect(m.navigate).toHaveBeenCalledWith({ to: "/auth/sign-in" });
    expect(signOutState.isRedirecting).toBe(false);
    handleUnauthorized();
    expect(location.replace).toHaveBeenCalledTimes(1);
  });

  it("does not end the session when pending edits cannot be saved", async () => {
    m.drain.mockResolvedValue(false);

    const { result } = renderHook(() =>
      useSignOut("https://idp.example.test/logout"),
    );
    await expect(result.current.mutateAsync()).rejects.toThrow(
      "tasks:detail.editor.saveFailed",
    );

    expect(m.signOut).not.toHaveBeenCalled();
    expect(signOutState.isRedirecting).toBe(false);
    expect(m.resume).toHaveBeenCalledTimes(1);
  });
});
