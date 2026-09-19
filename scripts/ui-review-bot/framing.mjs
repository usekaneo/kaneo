export function targetLocator(page, target) {
  if (target.by === "role")
    return page
      .getByRole(target.role, { name: target.name, exact: true })
      .first();
  if (target.by === "label")
    return page.getByLabel(target.name, { exact: true }).first();
  if (target.by === "placeholder")
    return page.getByPlaceholder(target.name, { exact: true }).first();
  return page.getByText(target.name, { exact: true }).first();
}

export function frameBounds(boxes, viewport) {
  if (
    !boxes.length ||
    boxes.some(
      (box) =>
        !box ||
        ![box.x, box.y, box.width, box.height].every(Number.isFinite) ||
        box.width <= 0 ||
        box.height <= 0,
    )
  )
    throw new Error("The preview target has no visible bounds.");
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  if (
    left < -1 ||
    top < -1 ||
    right > viewport.width + 1 ||
    bottom > viewport.height + 1
  )
    throw new Error(
      "The intended controls do not fit in the visible viewport.",
    );
  const width = Math.min(
    viewport.width,
    Math.max(640, Math.ceil(right - left + 48)),
  );
  const height = Math.min(
    viewport.height,
    Math.max(180, Math.ceil(bottom - top + 48)),
  );
  return {
    x: Math.max(
      0,
      Math.min(viewport.width - width, Math.floor((left + right - width) / 2)),
    ),
    y: Math.max(
      0,
      Math.min(
        viewport.height - height,
        Math.floor((top + bottom - height) / 2),
      ),
    ),
    width,
    height,
  };
}

export async function captureFrame(page, focus, visible = []) {
  const anchor = targetLocator(page, focus);
  await anchor.waitFor({ state: "visible", timeout: 5000 });
  await anchor.scrollIntoViewIfNeeded({ timeout: 5000 });
  const region = await anchor.evaluate((element) => {
    const rect = (node) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    for (
      let node = element;
      node && node !== document.body;
      node = node.parentElement
    ) {
      const r = rect(node);
      const style = getComputedStyle(node);
      const bordered =
        Number.parseFloat(style.borderTopWidth) > 0 &&
        Number.parseFloat(style.borderBottomWidth) > 0;
      const expanded =
        node.getAttribute("data-state") === "open" &&
        node.querySelector("button");
      const section =
        node.querySelector("h1,h2,h3,[role=heading]") &&
        node.querySelector("input,button,select,textarea");
      if (
        r.width >= 320 &&
        r.width <= 1100 &&
        r.height >= 64 &&
        r.height <= 650 &&
        (bordered ||
          section ||
          expanded ||
          node.getAttribute("role") === "dialog")
      )
        return r;
    }
    return rect(element);
  });
  const boxes = [region];
  for (const target of visible) {
    const control = targetLocator(page, target);
    await control.waitFor({ state: "visible", timeout: 5000 });
    boxes.push(await control.boundingBox());
  }
  // Popups are often portalled outside their field's card.
  for (const popup of await page
    .getByRole("listbox")
    .or(page.getByRole("menu"))
    .all())
    if (await popup.isVisible()) boxes.push(await popup.boundingBox());
  const clip = frameBounds(boxes, page.viewportSize());
  const scroll = await page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
  }));
  return { ...clip, x: clip.x + scroll.x, y: clip.y + scroll.y };
}
