const hostOrigin = location.origin;
const send = (message) => parent.postMessage(message, hostOrigin);
let expanded = false;

addEventListener("message", (event) => {
  if (event.source !== parent || event.origin !== hostOrigin) return;
  const message = event.data;
  if (message?.type === "quackback:identify") {
    const identity = message.data;
    const user =
      typeof identity?.id === "string" && typeof identity?.email === "string"
        ? {
            id: identity.id,
            email: identity.email,
            name: identity.name ?? identity.id,
          }
        : null;
    document.getElementById("user").textContent = user?.name ?? "Anonymous";
    send({ type: "quackback:identify-result", success: true, user });
  } else if (message?.type === "quackback:open") {
    document.getElementById("target").textContent = JSON.stringify(
      message.data ?? {},
      null,
      2,
    );
  }
});

document.getElementById("close").onclick = () =>
  send({ type: "quackback:close" });
document.getElementById("unread").onclick = () => {
  send({ type: "quackback:unread", count: 4 });
  send({ type: "quackback:close" });
};
document.getElementById("expand").onclick = (event) => {
  expanded = !expanded;
  event.currentTarget.textContent = expanded ? "Shrink panel" : "Expand panel";
  send({ type: "quackback:expand", expanded });
};
addEventListener("keydown", (event) => {
  if (event.key === "Escape") send({ type: "quackback:close" });
});
send({ type: "quackback:ready" });
