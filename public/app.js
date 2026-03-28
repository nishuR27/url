const $ = (id) => document.getElementById(id);

let API_BASE = ""; // will be detected

async function detectApiBase() {
  // Try relative first
  try {
    const r = await fetch("/status", { method: "GET" });
    if (r.ok) return "";
  } catch (e) {}
  // fallback to localhost control server
  try {
    const r2 = await fetch("http://localhost:3000/status", { method: "GET" });
    if (r2.ok) return "http://localhost:3000";
  } catch (e) {}
  return "";
}

async function api(path, opts = {}) {
  const base = API_BASE || "";
  const u = base ? `${base}${path}` : path;
  const res = await fetch(u, opts);
  if (res.headers.get("content-type")?.includes("application/json"))
    return res.json();
  return res;
}

function log(msg) {
  const d = document.createElement("div");
  d.textContent = `${new Date().toISOString()} ${msg}`;
  const logs = $("logs");
  logs.prepend(d);
}

function setIframes(count) {
  const container = $("iframeContainer");
  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const ifr = document.createElement("iframe");
    ifr.className = "previewFrame";
    // sandboxed preview to avoid accidental script access to parent
    ifr.sandbox = "allow-scripts allow-same-origin allow-forms allow-popups";
    ifr.src = "about:blank";
    container.appendChild(ifr);
  }
}

$("previewCount").addEventListener("change", (e) => {
  setIframes(Number(e.target.value || 1));
});

$("device").addEventListener("change", (e) => {
  const v = e.target.value;
  const iframes = document.querySelectorAll(".previewFrame");
  let w = "100%",
    h = 480;
  if (v) {
    const parts = v.split("x");
    w = parts[0] + "px";
    h = Number(parts[1]) || 480;
  }
  iframes.forEach((f) => {
    f.style.width = w;
    f.style.height = h + "px";
  });
});

$("start").addEventListener("click", async () => {
  const url = $("url").value.trim();
  const count = Number($("count").value) || 1;
  const interval = Number($("interval").value) || 5;
  if (!url) return alert("enter url");
  await api("/start", {
    method: "POST",
    body: JSON.stringify({ url, count, interval }),
  });
  log("Started");
});

$("stop").addEventListener("click", async () => {
  try {
    await api("/stop", { method: "POST" });
    log("Stopped");
  } catch (e) {
    log("Stop failed: " + e.message);
  }
});

$("showHar").addEventListener("click", async () => {
  try {
    const base = API_BASE || "";
    const r = await fetch(
      base ? `${base}/last_run_har.json` : "/last_run_har.json",
    );
    const har = r.ok ? await r.json() : null;
    const w = window.open("", "_blank");
    if (!w) return alert("Popup blocked");
    w.document.write(
      '<pre style="white-space:pre-wrap;word-break:break-word">' +
        (har ? JSON.stringify(har, null, 2) : "No HAR") +
        "</pre>",
    );
  } catch (e) {
    log("Show HAR failed: " + e.message);
  }
});

async function poll() {
  try {
    const sres = await fetch(API_BASE ? `${API_BASE}/status` : "/status");
    if (sres.ok) {
      const s = await sres.json();
      if (s.currentUrl) {
        const frames = document.querySelectorAll(".previewFrame");
        frames.forEach((f) => {
          try {
            f.src = s.currentUrl;
          } catch (e) {}
        });
      }
      if (s.running)
        log(
          `Running ${s.iterationsDone}/${s.totalIterations} ${s.currentUrl || ""}`,
        );
    }
  } catch (e) {
    // ignore — poll will try again
  }

  // show HAR and logs (non-blocking)
  try {
    const harr = await fetch(
      API_BASE ? `${API_BASE}/last_run_har.json` : "/last_run_har.json",
    );
    if (harr.ok) {
      const har = await harr.json();
      if (har && har.length) {
        const hits = har.slice(0, 6).map((h) => h.url || h);
        if (hits.length) log(`HAR hits: ${hits.join(", ")}`);
      }
    }
  } catch (e) {}

  try {
    const txt = await fetch(
      API_BASE ? `${API_BASE}/debug_runs.log` : "/debug_runs.log",
    )
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null);
    if (txt) {
      const lines = txt.trim().split("\n").slice(-6).reverse();
      for (const l of lines) log(`RUN: ${l}`);
    }
  } catch (e) {}

  setTimeout(poll, 2000);
}

async function setup() {
  API_BASE = await detectApiBase();
  if (API_BASE) log("Using API base: " + API_BASE);
  setIframes(Number($("previewCount").value || 1));

  // SSE (connect to control server for live events)
  try {
    const esUrl = API_BASE ? `${API_BASE}/events` : "/events";
    const es = new EventSource(esUrl);
    es.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        if (d.type === "child" || d.type === "child-err") log(d.message.trim());
        if (d.type === "status")
          log(
            `Status: ${d.running ? "running" : "stopped"} ${d.currentUrl || ""}`,
          );
      } catch (e) {}
    };
    es.onerror = () => {};
  } catch (e) {}

  poll();
}

setup();
