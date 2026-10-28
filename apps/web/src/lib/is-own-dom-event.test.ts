import type { SyntheticEvent } from "react";
import { describe, expect, it } from "vite-plus/test";
import { isOwnDomEvent } from "./is-own-dom-event";

const eventFor = (currentTarget: Element, target: EventTarget) =>
  ({ currentTarget, target }) as unknown as SyntheticEvent<Element>;

describe("isOwnDomEvent", () => {
  it("accepts events from the element and its DOM children", () => {
    const card = document.createElement("div");
    const chip = document.createElement("button");
    card.append(chip);

    expect(isOwnDomEvent(eventFor(card, card))).toBe(true);
    expect(isOwnDomEvent(eventFor(card, chip))).toBe(true);
  });

  it("rejects events that bubbled through a portal", () => {
    const card = document.createElement("div");
    const menuOption = document.createElement("div");
    document.body.append(card, menuOption);

    expect(isOwnDomEvent(eventFor(card, menuOption))).toBe(false);
  });
});
