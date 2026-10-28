import { expect, it } from "vite-plus/test";
import { buildVerifyOtpPath, readSignUpName } from "./verify-otp-path";

it("keeps the invitation and redirect in the code screen URL", () => {
  expect(
    buildVerifyOtpPath({
      email: "a+b@example.com",
      invitationId: "invite-1",
      redirect: "/dashboard",
    }),
  ).toBe(
    "/auth/verify-otp?email=a%2Bb%40example.com&invitationId=invite-1&redirect=%2Fdashboard",
  );
});

it.each([
  [{ signUpName: "  Jane Doe " }, "Jane Doe"],
  [{ signUpName: "   " }, undefined],
  [{ signUpName: 42 }, undefined],
  [null, undefined],
])("reads the sign-up name from history state %j", (state, name) => {
  expect(readSignUpName(state)).toBe(name);
});
