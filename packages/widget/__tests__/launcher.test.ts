// @vitest-environment happy-dom
/**
 * The launcher unread badge (Phase 7 unified unread): driven by the iframe's
 * quackback:unread messages, it shows a count only while the widget is CLOSED
 * (an alert on the close icon, or on an already-read open widget, is noise).
 */
import { describe, it, expect, beforeEach } from "vite-plus/test";
import { createLauncher } from "../src/core/launcher";

const badgeOf = (el: HTMLButtonElement) => el.lastElementChild as HTMLElement;

function make() {
  return createLauncher({ placement: "right", onClick: () => {} });
}

describe("launcher unread badge", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("is hidden by default", () => {
    expect(badgeOf(make().el).style.display).toBe("none");
  });

  it("stays inert when closed before its first reveal", () => {
    const launcher = make();
    launcher.setOpen(true);
    launcher.setOpen(false);
    expect(launcher.el.inert).toBe(true);
    launcher.reveal();
    expect(launcher.el.inert).toBe(false);
    launcher.setOpen(true);
    launcher.reveal();
    expect(launcher.el.inert).toBe(true);
  });

  it("shows the count when unread while closed", () => {
    const l = make();
    l.setUnread(3);
    const badge = badgeOf(l.el);
    expect(badge.style.display).toBe("flex");
    expect(badge.textContent).toBe("3");
  });

  it("caps the display at 9+", () => {
    const l = make();
    l.setUnread(42);
    expect(badgeOf(l.el).textContent).toBe("9+");
  });

  it("hides again when unread returns to 0", () => {
    const l = make();
    l.setUnread(5);
    l.setUnread(0);
    expect(badgeOf(l.el).style.display).toBe("none");
  });

  it("hides while the widget is open, and returns on close", () => {
    const l = make();
    l.setUnread(4);
    l.setOpen(true);
    expect(badgeOf(l.el).style.display).toBe("none");
    l.setOpen(false);
    expect(badgeOf(l.el).style.display).toBe("flex");
  });

  it("coerces a negative/fractional count defensively", () => {
    const l = make();
    l.setUnread(-3);
    expect(badgeOf(l.el).style.display).toBe("none");
    l.setUnread(2.9);
    expect(badgeOf(l.el).textContent).toBe("2");
  });

  it.each([Number.NaN, Infinity, -Infinity])(
    "ignores non-finite counts: %s",
    (count) => {
      const l = make();
      l.setUnread(count);
      expect(badgeOf(l.el).style.display).toBe("none");
    },
  );
});

const bubbleOf = () => document.querySelector("body > div") as HTMLElement;

describe("launcher greeting bubble", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it("is hidden until a greeting is set", () => {
    make();
    expect(bubbleOf().style.display).toBe("none");
  });

  it("shows the greeting text while closed", () => {
    const l = make();
    l.setGreeting("Need a hand?");
    const bubble = bubbleOf();
    expect(bubble.style.display).toBe("flex");
    expect(bubble.textContent).toContain("Need a hand?");
  });

  it("hides for an empty or whitespace greeting", () => {
    const l = make();
    l.setGreeting("   ");
    expect(bubbleOf().style.display).toBe("none");
    l.setGreeting("Hi");
    expect(bubbleOf().style.display).toBe("flex");
    l.setGreeting(null);
    expect(bubbleOf().style.display).toBe("none");
  });

  it("hides while the widget is open, returns on close", () => {
    const l = make();
    l.setGreeting("Hi there");
    l.setOpen(true);
    expect(bubbleOf().style.display).toBe("none");
    l.setOpen(false);
    expect(bubbleOf().style.display).toBe("flex");
  });

  it("clicking the text opens the widget", () => {
    let opened = 0;
    const l = createLauncher({
      placement: "right",
      onClick: () => (opened += 1),
    });
    l.setGreeting("Hi");
    const greeting = bubbleOf().firstElementChild as HTMLButtonElement;
    expect(greeting.tagName).toBe("BUTTON");
    greeting.click();
    expect(opened).toBe(1);
    l.remove();
    greeting.click();
    l.el.click();
    expect(opened).toBe(1);
  });

  it("dismiss hides it and persists for the session", () => {
    const l = make();
    l.setGreeting("Hi");
    const bubble = bubbleOf();
    (bubble.lastElementChild as HTMLElement).click(); // the × button
    expect(bubble.style.display).toBe("none");
    // A fresh launcher in the same session stays dismissed.
    document.body.innerHTML = "";
    const l2 = make();
    l2.setGreeting("Hi again");
    expect(bubbleOf().style.display).toBe("none");
  });
});

describe("launcher label", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("is an icon-only circle with no label text by default", () => {
    const l = make();
    expect(l.el.textContent).toBe("");
    expect(l.el.style.width).toBe("40px");
    expect(l.el.style.borderRadius).toBe("50%");
  });

  it("setLabel renders the text beside the icon as a pill", () => {
    const l = make();
    l.setLabel("Chat with us");
    expect(l.el.textContent).toContain("Chat with us");
    expect(l.el.style.width).toBe("auto");
    expect(l.el.style.borderRadius).toBe("20px");
  });

  it("the visible label becomes the accessible name", () => {
    const l = make();
    l.setLabel("Chat with us");
    expect(l.el.getAttribute("aria-label")).toBe("Chat with us");
    l.setLabel(null);
    expect(l.el.getAttribute("aria-label")).toBe("Open feedback widget");
  });

  it("clearing the label returns to the icon-only circle", () => {
    const l = make();
    l.setLabel("Chat with us");
    l.setLabel("");
    expect(l.el.textContent).toBe("");
    expect(l.el.style.width).toBe("40px");
    expect(l.el.style.borderRadius).toBe("50%");
  });
});

describe("launcher setPlacement", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("moves the button between corners", () => {
    const l = make();
    expect(l.el.style.right).toBe("20px");
    l.setPlacement("left");
    expect(l.el.style.left).toBe("20px");
    expect(l.el.style.right).toBe("");
    l.setPlacement("right");
    expect(l.el.style.right).toBe("20px");
    expect(l.el.style.left).toBe("");
  });

  it("moves the greeting bubble to the same side", () => {
    const l = make();
    l.setGreeting("Hi");
    l.setPlacement("left");
    const bubble = bubbleOf();
    expect(bubble.style.left).toBe("20px");
    expect(bubble.style.right).toBe("");
  });
});

describe("launcher contained in a root", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it("positions absolutely inside the root instead of the viewport", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const l = createLauncher({ placement: "right", root, onClick: () => {} });
    expect(l.el.parentElement).toBe(root);
    expect(l.el.style.position).toBe("absolute");
    expect(l.el.style.right).toBe("0px");
    expect(l.el.style.bottom).toBe("0px");
  });

  it("does not write the host-page greeting dismiss key", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const l = createLauncher({ placement: "right", root, onClick: () => {} });
    l.setGreeting("Hi");
    const bubble = root.querySelector("div") as HTMLElement;
    (bubble.lastElementChild as HTMLElement).click();
    expect(bubble.style.display).toBe("none");
    expect(
      sessionStorage.getItem("quackback:launcher-greeting-dismissed"),
    ).toBeNull();
  });
});
