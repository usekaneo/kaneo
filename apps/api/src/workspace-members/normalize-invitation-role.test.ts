import { describe, expect, it } from "vite-plus/test";
import { normalizeInvitationRole } from "./normalize-invitation-role";

describe("invitation role normalization", () => {
  it.each([
    [" member, owner ", "member,owner"],
    [["member", "\towner\n"], "member,owner"],
    [["member, owner", "member"], "member,owner"],
    [" member , recruiter,member,,", "member,recruiter"],
  ])("normalizes valid provider role shapes (%j)", (input, expected) => {
    expect(normalizeInvitationRole(input)).toBe(expected);
  });

  it.each(
    [null, undefined, 1, {}, ["member", 1], [["owner"]]].map((role) => ({
      role,
    })),
  )("leaves invalid shapes for provider validation ($role)", ({ role }) => {
    expect(normalizeInvitationRole(role)).toBeUndefined();
  });
});
