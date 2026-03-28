import fetch from "node-fetch";
import fs from "node:fs";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

const JSDELIVR_BASE =
  "https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/all/data.txt";
const CACHE_FILE = "verified_proxies.json";

async function fetchRawProxies() {
  try {
    const res = await fetch(JSDELIVR_BASE, { timeout: 15000 });
    if (!res.ok) return [];
    const text = await res.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));

    // Normalize: if a line doesn't include protocol, prefix with http://
    const normalized = lines.map((l) => {
      if (/^https?:\/\//i.test(l) || /^socks/i.test(l)) return l;
      return `http://${l}`;
    });

    return normalized;
  } catch (err) {
    console.error("getProxies failed:", err.message);
    return [];
  }
}

async function verifyProxy(proxy, timeout = 12000) {
  // Try launching a short-lived headless browser using the proxy and navigate to example.com
  const launchArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    `--proxy-server=${proxy}`,
    "--disable-blink-features=AutomationControlled",
  ];
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: launchArgs,
      timeout: 20000,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });
    const resp = await page
      .goto("https://example.com/", { waitUntil: "domcontentloaded", timeout })
      .catch(() => null);
    if (!resp) return false;
    const url = page.url();
    if (!url || url.startsWith("chrome-error://")) return false;
    return true;
  } catch (e) {
    return false;
  } finally {
    try {
      if (browser) await browser.close().catch(() => {});
    } catch (e) {}
  }
}

function readCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const j = JSON.parse(raw);
    return j;
  } catch (e) {
    return null;
  }
}

function writeCache(proxies) {
  try {
    const data = { ts: Date.now(), proxies };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data), "utf8");
  } catch (e) {
    // ignore
  }
}

export async function getProxies({
  verify = false,
  maxVerify = 10,
  concurrency = 4,
  cacheTtl = 1000 * 60 * 30,
} = {}) {
  // Check cache
  try {
    const cache = readCache();
    if (
      cache &&
      Array.isArray(cache.proxies) &&
      Date.now() - cache.ts < cacheTtl
    ) {
      return cache.proxies;
    }
  } catch (e) {
    // ignore
  }

  const raw = await fetchRawProxies();
  if (!raw || raw.length === 0) return [];

  const toTest = raw.slice(0, Math.max(20, maxVerify));

  // If caller doesn't request active verification, return the raw list (capped).
  if (!verify) {
    try {
      writeCache(toTest);
    } catch (e) {
      // ignore cache write errors
    }
    return toTest;
  }

  const verified = [];

  // Sequential verification (simple and reliable). This avoids concurrency bugs
  // and long-running Promise pools that can hang in constrained environments.
  for (const p of toTest) {
    try {
      const ok = await verifyProxy(p).catch(() => false);
      if (ok) verified.push(p);
    } catch (e) {
      // ignore single proxy errors
    }
  }

  writeCache(verified);
  return verified;
}
