const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const $ = (id) => document.getElementById(id);

function show(el, text) {
  el.textContent = text ?? "";
  el.hidden = !text;
}

function statusText(s) {
  if (s.mode === "paused") return "Paused";
  if (s.offline) {
    const items = s.pending === 1 ? "1 item" : `${s.pending} items`;
    return `Offline — ${items} waiting to sync`;
  }
  return "Tracking";
}

// Only shown when the company clocks people in and out from this app.
function attendanceText(a) {
  if (!a || !a.autoClock) return null;
  if (!a.clockedIn) return "Not clocked in. You'll be clocked in when you start working.";
  const at = new Date(a.since).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return a.automatic ? `Clocked in automatically at ${at}` : `Clocked in at ${at}`;
}

function render(s) {
  const connected = s.mode !== "not_connected";
  $("pair").hidden = connected;
  $("connected").hidden = !connected;

  if (!connected) {
    show($("pair-error"), s.lastError);
    return;
  }

  $("who").textContent = `Connected to ${s.workspaceName} as ${s.userName}`;
  $("status").textContent = statusText(s);
  $("dot").className = `dot ${s.offline ? "offline" : s.mode}`;
  show($("attendance"), attendanceText(s.attendance));
  $("last-sync").textContent = s.lastSync
    ? `Last sync ${new Date(s.lastSync).toLocaleTimeString()}`
    : "Not synced yet";
  show($("sync-error"), s.offline ? null : s.lastError);
  $("toggle").textContent = s.mode === "paused" ? "Resume tracking" : "Pause tracking";
  $("toggle").dataset.paused = String(s.mode === "paused");
}

async function refresh() {
  render(await invoke("get_status"));
}

$("pair").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("connect");
  button.disabled = true;
  button.textContent = "Connecting…";
  show($("pair-error"), null);
  try {
    render(await invoke("connect", { address: $("address").value, code: $("code").value }));
    $("code").value = "";
  } catch (error) {
    show($("pair-error"), String(error));
  } finally {
    button.disabled = false;
    button.textContent = "Connect";
  }
});

$("toggle").addEventListener("click", async () => {
  const paused = $("toggle").dataset.paused === "true";
  render(await invoke("set_paused", { paused: !paused }));
});

// Two clicks instead of window.confirm, which not every webview implements.
let confirmTimer;
$("disconnect").addEventListener("click", async () => {
  const button = $("disconnect");
  if (button.dataset.armed !== "true") {
    button.dataset.armed = "true";
    button.textContent = "Click again to disconnect";
    confirmTimer = setTimeout(() => {
      button.dataset.armed = "false";
      button.textContent = "Disconnect this computer";
    }, 4000);
    return;
  }
  clearTimeout(confirmTimer);
  button.dataset.armed = "false";
  button.textContent = "Disconnect this computer";
  render(await invoke("disconnect"));
});

listen("status", (event) => render(event.payload));
refresh();
setInterval(refresh, 10_000);
