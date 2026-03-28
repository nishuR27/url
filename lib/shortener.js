import fetch from "node-fetch";
import fs from "node:fs";
import { API_KEYS, SHORTS_FILE } from "./config.js";
import { randomDelayMs } from "./utils.js";

async function shortenWithService(svc, key, longUrl) {
  try {
    // Try text format first (NowShort supports &format=text)
    const urlText = `${svc.base}${encodeURIComponent(key)}&url=${encodeURIComponent(longUrl)}&format=text`;
    let res = await fetch(urlText, { timeout: 15000 }).catch(() => null);
    let text = null;
    if (res && res.ok) {
      text = await res.text();
      if (text && text.startsWith("http")) return text.trim();
    }

    // Fallback to JSON/plain endpoint
    const url = `${svc.base}${encodeURIComponent(key)}&url=${encodeURIComponent(longUrl)}`;
    res = await fetch(url, { timeout: 15000 });
    text = await res.text();
    // Try parse JSON responses (many APIs return JSON)
    try {
      const j = JSON.parse(text);
      // common fields that may contain the short URL
      const candidates = [
        j.shortenedUrl,
        j.shortUrl,
        j.short,
        j.url,
        j.result,
        j.data && (j.data.shortenedUrl || j.data.shortUrl || j.data.url),
      ];
      for (const c of candidates) {
        if (typeof c === "string" && c.startsWith("http")) return c.trim();
      }
      // some APIs return { status: 'success', shortenedUrl: '...' }
    } catch (e) {
      // not JSON — fall through to plain text handling
    }

    // plain text response (some services return the URL directly)
    if (text && text.startsWith("http") && text.length < 1000)
      return text.trim();
  } catch {}
  return null;
}

export async function shortenUrl(longUrl) {
  const paidServices = [
    // { name: "get2short", base: "https://get2short.com/api?api=" },
    // { name: "babylinks", base: "https://babylinks.in/api?api=" },
    { name: "nowshort", base: "https://nowshort.com/api?api=" },
    // { name: "cpm", base: "https://cpmshort.com/api?api=" },
  ];

  for (const svc of paidServices) {
    const key = API_KEYS[svc.name];
    if (!key) continue;
    const s = await shortenWithService(svc, key, longUrl);
    if (s) {
      console.log(`Shortened via ${svc.name}: ${s}`);
      return s;
    }
  }

  // free fallback
  // try {
  //   const res = await fetch(
  //     `https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`,
  //     { timeout: 10000 },
  //   );
  //   const text = await res.text();
  //   if (text.startsWith("http")) {
  //     console.log(`Shortened via is.gd: ${text}`);
  //     return text.trim();
  //   }
  // } catch {}

  return null;
}

export async function generateShortLinks(LONG_URLS) {
  const shorts = [];
  const map = {};
  for (const long of LONG_URLS) {
    const short = await shortenUrl(long);
    if (short) shorts.push(short);
    if (short) map[short] = long;
    await randomDelayMs(2000, 5000);
  }
  if (shorts.length > 0)
    fs.writeFileSync(SHORTS_FILE, JSON.stringify(shorts, null, 2));
  try {
    fs.writeFileSync("shorts_map.json", JSON.stringify(map, null, 2));
  } catch (e) {}
  return shorts;
}
