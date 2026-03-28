#!/usr/bin/env node
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const publicDir = path.join(__dirname, "public");

app.use(express.static(publicDir));
app.use(express.json());

let running = false;
let currentUrl = null;
let iterationsDone = 0;
let totalIterations = 0;
let child = null;
let lastChildLines = [];
const sseClients = new Set();

function broadcastEvent(obj) {
  const data = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch (e) {}
  }
}

async function startLoop(url, count, intervalSec) {
  if (running) return;
  running = true;
  iterationsDone = 0;
  totalIterations = count;
  for (let i = 0; i < count && running; i++) {
    currentUrl = url;
    iterationsDone = i;
    // spawn run_single.js
    child = spawn(process.execPath, ["run_single.js"], {
      cwd: path.join(__dirname),
      env: {
        ...process.env,
        SINGLE_LINK: url,
        HEADFUL: "1",
        SKIP_SHORTEN: "1",
        HAR_CAPTURE: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (d) => {
      const s = d.toString();
      console.log("[child]", s.trim());
      lastChildLines.push({ ts: new Date().toISOString(), out: s });
      if (lastChildLines.length > 200) lastChildLines.shift();
      broadcastEvent({ type: "child", message: s });
    });
    child.stderr.on("data", (d) => {
      const s = d.toString();
      console.error("[child]", s.trim());
      lastChildLines.push({ ts: new Date().toISOString(), out: s });
      if (lastChildLines.length > 200) lastChildLines.shift();
      broadcastEvent({ type: "child-err", message: s });
    });
    await new Promise((resolve) => {
      child.on("exit", () => {
        child = null;
        resolve();
      });
      child.on("error", () => {
        child = null;
        resolve();
      });
    });
    const waitMs = Math.max(1000, Math.round(intervalSec * 1000));
    await new Promise((r) => setTimeout(r, waitMs));
  }
  running = false;
  currentUrl = null;
}

app.post("/start", (req, res) => {
  const { url, count = 1, interval = 5 } = req.body || {};
  if (!url) return res.json({ ok: false, error: "no url" });
  startLoop(url, Number(count), Number(interval));
  res.json({ ok: true });
});

app.post("/stop", (req, res) => {
  running = false;
  if (child && !child.killed) {
    try {
      child.kill();
    } catch (e) {}
    child = null;
  }
  res.json({ ok: true });
});

app.get("/status", (req, res) => {
  res.json({ running, currentUrl, iterationsDone, totalIterations });
});

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write("\n");
  sseClients.add(res);
  res.write(
    `data: ${JSON.stringify({ type: "status", running, currentUrl, iterationsDone, totalIterations })}\n\n`,
  );
  const keep = setInterval(() => {
    try {
      res.write(":keep\n\n");
    } catch (e) {}
  }, 20000);
  req.on("close", () => {
    clearInterval(keep);
    sseClients.delete(res);
  });
});

// serve debug artifacts from project root when available
app.get("/last_run_har.json", (req, res) => {
  const p = path.join(__dirname, "last_run_har.json");
  if (fs.existsSync(p)) res.sendFile(p);
  else res.status(404).send("Not found");
});
app.get("/debug_runs.log", (req, res) => {
  const p = path.join(__dirname, "debug_runs.log");
  if (fs.existsSync(p)) res.sendFile(p);
  else res.status(404).send("Not found");
});

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`Control server (Express) listening on http://localhost:${port}`),
);
