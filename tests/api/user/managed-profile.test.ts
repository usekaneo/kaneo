import { describe, expect, it } from "vite-plus/test";
import { buildAvatarUrl } from "../../../apps/api/src/user/avatar";
import {
  canRemoveAvatar,
  changesManagedProfile,
  planManagedProfileRefresh,
  type StoredProfile,
} from "../../../apps/api/src/user/managed-profile";

const upload = buildAvatarUrl("avatar-1");
const picture = "https://id.example.com/jane.png";

function stored(overrides: Partial<StoredProfile> = {}): StoredProfile {
  return { name: "Jane Doe", image: null, locale: "en-US", ...overrides };
}

describe("canRemoveAvatar", () => {
  it("allows removing an upload or nothing", () => {
    expect(canRemoveAvatar(upload)).toBe(true);
    expect(canRemoveAvatar(null)).toBe(true);
  });

  it("refuses removing the provider's picture", () => {
    expect(canRemoveAvatar(picture)).toBe(false);
  });
});

describe("changesManagedProfile", () => {
  const all = ["name", "image", "locale"] as const;

  it("ignores fields the request leaves out", () => {
    expect(changesManagedProfile({ name: undefined }, stored(), ["name"])).toBe(
      false,
    );
  });

  it("accepts the current values sent again", () => {
    expect(
      changesManagedProfile(
        { name: "Jane Doe", image: picture, locale: "en-US" },
        stored({ image: picture }),
        all,
      ),
    ).toBe(false);
  });

  it.each([
    [{ name: "Janet" }],
    [{ locale: "de-DE" }],
    [{ image: "https://id.example.com/other.png" }],
    [{ image: buildAvatarUrl("avatar-2") }],
  ])("refuses a changed managed value %o", (data) => {
    expect(changesManagedProfile(data, stored({ image: upload }), all)).toBe(
      true,
    );
  });

  it("accepts changes to fields the provider does not manage", () => {
    expect(
      changesManagedProfile(
        { name: "Janet", locale: "de-DE", image: picture },
        stored({ image: picture }),
        ["image"],
      ),
    ).toBe(false);
  });

  it("allows removing a picture uploaded to Kaneo", () => {
    expect(
      changesManagedProfile({ image: null }, stored({ image: upload }), [
        "image",
      ]),
    ).toBe(false);
  });

  it("refuses removing the provider's picture", () => {
    expect(
      changesManagedProfile({ image: null }, stored({ image: picture }), [
        "image",
      ]),
    ).toBe(true);
  });
});

describe("planManagedProfileRefresh", () => {
  it("updates only the listed fields", () => {
    expect(
      planManagedProfileRefresh(
        { name: "Janet Doe", picture, locale: "de" },
        stored(),
        ["name"],
      ),
    ).toEqual({ update: { name: "Janet Doe" }, removeUploadedAvatar: false });
  });

  it("derives the name like account creation does", () => {
    expect(
      planManagedProfileRefresh(
        { given_name: "Janet", family_name: "Doe" },
        stored(),
        ["name"],
      ).update,
    ).toEqual({ name: "Janet Doe" });
  });

  it("leaves an unchanged profile alone", () => {
    expect(
      planManagedProfileRefresh(
        { name: "Jane Doe", picture, locale: "en" },
        stored({ image: picture }),
        ["name", "image", "locale"],
      ),
    ).toEqual({ update: {}, removeUploadedAvatar: true });
  });

  it("replaces an upload with the provider's picture and removes the upload", () => {
    expect(
      planManagedProfileRefresh({ picture }, stored({ image: upload }), [
        "image",
      ]),
    ).toEqual({ update: { image: picture }, removeUploadedAvatar: true });
  });

  it.each([undefined, "not a url"])(
    "keeps an upload while the picture is %p",
    (value) => {
      expect(
        planManagedProfileRefresh(
          { picture: value },
          stored({ image: upload }),
          ["image"],
        ),
      ).toEqual({ update: {}, removeUploadedAvatar: false });
    },
  );

  it("clears a picture the provider no longer sends", () => {
    expect(
      planManagedProfileRefresh({}, stored({ image: picture }), ["image"]),
    ).toEqual({ update: { image: null }, removeUploadedAvatar: false });
  });

  it("does nothing without a picture on either side", () => {
    expect(planManagedProfileRefresh({}, stored(), ["image"])).toEqual({
      update: {},
      removeUploadedAvatar: false,
    });
  });

  it("stores the supported locale for the claim", () => {
    expect(
      planManagedProfileRefresh({ locale: "de" }, stored(), ["locale"]).update,
    ).toEqual({ locale: "de-DE" });
  });

  it.each([undefined, "sv"])(
    "keeps the locale when the claim is %p",
    (locale) => {
      expect(
        planManagedProfileRefresh({ locale }, stored(), ["locale"]).update,
      ).toEqual({});
    },
  );
});
