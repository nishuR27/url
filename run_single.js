#!/usr/bin/env node
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import { USER_AGENTS, INDIAN_NAMES, EMAIL_DOMAINS } from "./lib/config.js";
import { getProxies } from "./lib/proxyProvider.js";
import {
  randomItem,
  randomDelayMs,
  simulateHuman,
  bypassObstacles,
  tryLead,
} from "./lib/utils.js";

async function simulateClickRegistration(page) {
  try {
    const phrases = [
      "continue",
      "proceed",
      "get link",
      "Watch sponsor message to continue",
      "next",
      "click here",
      "continue to destination",
    ];
    // Try in-page element.click via evaluate
    const clickedHref = await page.evaluate((phrases) => {
      const re = new RegExp(phrases.join("|"), "i");
      const candidates = Array.from(
        document.querySelectorAll("a,button,input"),
      );
      for (const el of candidates) {
        const text = (el.innerText || el.value || "").trim();
        if (re.test(text)) {
          try {
            el.click();
          } catch (e) {}
          const href = el.href || el.getAttribute("href") || el.value || null;
          if (href) return href;
        }
      }
      return null;
    }, phrases);
    if (clickedHref) return { method: "eval-click", href: clickedHref };

    // If no in-page click, try bounding box mouse click on likely elements
    for (const sel of ["a", "button", "[role=button]", "input[type=button]"]) {
      const els = await page.$$(sel).catch(() => []);
      for (const el of els) {
        try {
          const txt = await el.evaluate((e) =>
            (e.innerText || e.value || "").trim(),
          );
          if (!txt) continue;
          if (phrases.some((p) => txt.toLowerCase().includes(p))) {
            const box = await el.boundingBox();
            if (box) {
              await page.mouse.move(
                box.x + box.width / 2,
                box.y + box.height / 2,
                { steps: 10 },
              );
              await page.mouse.down();
              await page.mouse.up();
              await randomDelayMs(150, 350);
              const href = await el.evaluate(
                (e) => e.href || e.getAttribute("href") || e.value || null,
              );
              return { method: "mouse-click", href };
            }
          }
        } catch (e) {}
      }
    }

    // dispatch pointer events on document body as a last resort
    await page.evaluate(() => {
      const ev = new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(ev);
      const ev2 = new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(ev2);
    });
    await randomDelayMs(120, 300);
    return { method: "dispatch", href: null };
  } catch (e) {
    return null;
  }
}

puppeteer.use(StealthPlugin());

async function visitSingle(shortUrl) {
  const proxies =
    process.env.NO_PROXY === "1" ? [] : await getProxies().catch(() => []);
  const proxy = randomItem(proxies) || undefined;
  console.log(`Visiting ${shortUrl} | Proxy: ${proxy || "direct"}`);

  const launchArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--window-size=1366,768",
  ];
  // Add WebRTC / IP masking flags
  launchArgs.push(
    "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
    "--enable-features=WebRtcHideLocalIpsWithMdns",
    "--enable-experimental-web-platform-features",
  );
  if (proxy) launchArgs.push(`--proxy-server=${proxy}`);

  const headful = process.env.HEADFUL === "1";
  let browser = await puppeteer.launch({
    headless: !headful,
    args: launchArgs,
    timeout: 60000,
  });
  let page = await browser.newPage();
  // Attempt to align timezone and geolocation with proxy IP (if available)
  try {
    let tz = null;
    let geo = null;
    if (proxy) {
      const ip = proxy.split(":")[0];
      try {
        const r = await fetch(
          `http://ip-api.com/json/${ip}?fields=status,country,timezone,lat,lon`,
        ).catch(() => null);
        if (r && r.ok) {
          const j = await r.json();
          if (j && j.status === "success") {
            tz = j.timezone;
            geo = { latitude: j.lat, longitude: j.lon };
          }
        }
      } catch (e) {}
    }
    // fallback: random geo
    if (!geo) {
      geo = {
        latitude: Math.random() * 170 - 85,
        longitude: Math.random() * 360 - 180,
      };
    }
    if (!tz) {
      tz = randomItem([
        "UTC",
        "Asia/Kolkata",
        "Europe/London",
        "America/New_York",
        "Asia/Kuala_Lumpur",
      ]);
    }

    // grant geolocation permission for target origin
    try {
      const origin = new URL(shortUrl).origin;
      await page.context().overridePermissions(origin, ["geolocation"]);
    } catch (e) {}

    const client = await page.target().createCDPSession();
    try {
      // Timezone overriding may conflict with stealth plugins; skip to avoid ProtocolError.
    } catch (e) {}
    try {
      await client
        .send("Emulation.setGeolocationOverride", {
          latitude: geo.latitude,
          longitude: geo.longitude,
          accuracy: 100,
        })
        .catch(() => {});
    } catch (e) {}
  } catch (e) {}
  // Spoof a few navigator and environment properties to appear as different devices/locations
  try {
    const hw = 2 + Math.floor(Math.random() * 6);
    const mem = [2, 4, 8, 16][Math.floor(Math.random() * 4)];
    const platform = randomItem(["Win32", "MacIntel", "Linux x86_64", "Win64"]);
    await page.evaluateOnNewDocument(
      (hw, mem, platform) => {
        try {
          Object.defineProperty(navigator, "hardwareConcurrency", {
            get: () => hw,
            configurable: true,
          });
          Object.defineProperty(navigator, "deviceMemory", {
            get: () => mem,
            configurable: true,
          });
          Object.defineProperty(navigator, "platform", {
            get: () => platform,
            configurable: true,
          });
          Object.defineProperty(navigator, "webdriver", {
            get: () => false,
            configurable: true,
          });
        } catch (e) {}
      },
      hw,
      mem,
      platform,
    );
  } catch (e) {}
  await page.setUserAgent(randomItem(USER_AGENTS));
  await page.setViewport({
    width: 1280 + Math.floor(Math.random() * 400),
    height: 720 + Math.floor(Math.random() * 300),
  });
  // randomize Accept-Language header
  try {
    const langs = [
      "en-US,en;q=0.9",
      "en-GB,en;q=0.9",
      "hi-IN,en;q=0.9",
      "fr-FR,fr;q=0.9,en;q=0.8",
    ];
    await page.setExtraHTTPHeaders({ "accept-language": randomItem(langs) });
    // set fake timezone
    const tz = randomItem([
      "America/New_York",
      "Europe/London",
      "Asia/Kolkata",
      "Asia/Kuala_Lumpur",
      "Australia/Sydney",
    ]);
    try {
      (await page.emulateTimezone) && page.emulateTimezone(tz);
    } catch (e) {}
  } catch (e) {}
  const trackingRequestsDetailed = [];
  const observedUrls = new Set();
  if (process.env.HAR_CAPTURE === "1") {
    page.on("request", (req) => {
      try {
        trackingRequestsDetailed.push({
          type: "request",
          url: req.url(),
          method: req.method(),
          headers: req.headers(),
          postData: req.postData ? req.postData() : undefined,
        });
      } catch (e) {}
    });
    page.on("response", (res) => {
      try {
        const req = res.request ? res.request() : null;
        trackingRequestsDetailed.push({
          type: "response",
          url: res.url(),
          status: res.status(),
          headers: res.headers(),
          request:
            req ?
              { url: req.url(), method: req.method(), headers: req.headers() }
            : undefined,
        });
      } catch (e) {}
    });
  }
  // always capture observed urls for behavior logging
  page.on("request", (req) => {
    try {
      observedUrls.add(req.url());
    } catch (e) {}
  });
  page.on("response", (res) => {
    try {
      observedUrls.add(res.url());
    } catch (e) {}
  });

  // also track frame navigations
  page.on("framenavigated", (frame) => {
    try {
      console.log("Frame navigated:", frame.url());
      try {
        observedUrls.add(frame.url());
      } catch (e) {}
    } catch (e) {}
  });

  try {
    const resp = await page
      .goto(shortUrl, { waitUntil: "domcontentloaded", timeout: 45000 })
      .catch(() => null);
    await randomDelayMs(1200, 1200);
    console.log("Response URL:", resp ? resp.url() : "(no response)");
    console.log("Page URL:", await page.url());

    // Dump short content snippet for debugging
    try {
      const html = await page.content();
      console.log("Page content snippet:\n", html.slice(0, 4000));
    } catch (e) {
      console.log("Could not read page content:", e && e.message);
    }

    // List frames and their URLs
    let frames = [];
    try {
      frames = page.frames();
      for (const f of frames) {
        try {
          console.log(`Frame: ${f.url()}`);
          const fh = await f.content();
          console.log(fh.slice(0, 800));
        } catch (e) {
          // ignore frame content errors
        }
      }
    } catch (e) {
      // ignore
    }

    // If we see chrome-error frames that often indicate a bad proxy, retry without proxy
    const sawChromeError = frames.some((f) =>
      (f.url() || "").startsWith("chrome-error://"),
    );
    if (sawChromeError && proxy) {
      console.log(
        "Detected chrome-error frame (likely bad proxy). Retrying without proxy...",
      );
      try {
        await browser.close().catch(() => {});
      } catch (e) {
        // ignore
      }

      // Relaunch without proxy
      const launchArgsNoProxy = launchArgs.filter(
        (a) => !a.startsWith("--proxy-server="),
      );
      browser = await puppeteer.launch({
        headless: !headful,
        args: launchArgsNoProxy,
        timeout: 60000,
      });
      page = await browser.newPage();
      await page.setUserAgent(randomItem(USER_AGENTS));
      await page.setViewport({
        width: 1280 + Math.floor(Math.random() * 400),
        height: 720 + Math.floor(Math.random() * 300),
      });

      const resp2 = await page
        .goto(shortUrl, { waitUntil: "domcontentloaded", timeout: 45000 })
        .catch(() => null);
      await randomDelayMs(1200, 1200);
      console.log("Response URL:", resp2 ? resp2.url() : "(no response)");
      console.log("Page URL:", await page.url());
    }

    // Iteratively attempt to bypass/trigger sponsor opens until we observe the original target
    // Load mapping of shorts -> original
    let shortsMap = {};
    try {
      if (fs.existsSync("shorts_map.json"))
        shortsMap = JSON.parse(fs.readFileSync("shorts_map.json", "utf8"));
      else if (shortUrl.includes("babylinks.in/FKthHKw")) {
        shortsMap[shortUrl] = "https://github.com/nishur27";
        try {
          fs.writeFileSync(
            "shorts_map.json",
            JSON.stringify(shortsMap, null, 2),
          );
        } catch (e) {}
      }
    } catch (e) {}

    const original = shortsMap[shortUrl] || null;
    const originalHost = original ? new URL(original).host : null;
    let reached = false;
    let attempts = 0;
    const maxAttempts = 12;
    let afterUrl = null;
    while (attempts < maxAttempts && !reached) {
      attempts++;
      await simulateHuman(page);
      await bypassObstacles(page);
      // attempt stronger simulated clicks to trigger provider tracking
      const clickResult = await simulateClickRegistration(page).catch(
        () => null,
      );
      if (clickResult && clickResult.href)
        console.log("Simulated click result:", clickResult);
      await page.waitForNavigation({ timeout: 7000 }).catch(() => {});
      try {
        afterUrl = page.url();
        if (afterUrl) observedUrls.add(afterUrl);
      } catch (e) {
        afterUrl = null;
      }
      console.log("After bypass URL:", afterUrl);

      // check observed URLs and final page URL for original target
      if (original) {
        if (afterUrl && afterUrl.includes(original)) reached = true;
        if (!reached) {
          for (const u of Array.from(observedUrls)) {
            try {
              if (
                u.includes(original) ||
                (originalHost && u.includes(originalHost))
              ) {
                reached = true;
                break;
              }
            } catch (e) {}
          }
        }
      }
      if (reached) break;

      // if not reached, try slight scroll and wait before next attempt
      await page
        .evaluate(() => window.scrollBy({ top: 200, behavior: "smooth" }))
        .catch(() => {});
      await randomDelayMs(800, 1800);
    }
    console.log("Reached original?", reached, "attempts:", attempts);

    await simulateHuman(page);
    const lead = await tryLead(page, INDIAN_NAMES, EMAIL_DOMAINS);
    console.log("Lead submitted?", !!lead);
    await randomDelayMs(2000, 5000);

    // write a debug log line
    try {
      const record = {
        ts: new Date().toISOString(),
        shortUrl,
        landed: afterUrl || null,
        reachedOriginal: !!(
          shortsMap &&
          shortsMap[shortUrl] &&
          afterUrl &&
          afterUrl.includes(shortsMap[shortUrl])
        ),
        attempts: typeof attempts === "number" ? attempts : undefined,
        observed: Array.from(observedUrls).slice(-200),
        lead: !!lead,
      };
      fs.appendFileSync("debug_runs.log", JSON.stringify(record) + "\n");
      if (process.env.HAR_CAPTURE === "1") {
        try {
          fs.writeFileSync(
            "../last_run_har.json",
            JSON.stringify(trackingRequestsDetailed, null, 2),
          );
        } catch (e) {
          try {
            fs.writeFileSync(
              "last_run_har.json",
              JSON.stringify(trackingRequestsDetailed, null, 2),
            );
          } catch (e2) {}
        }
      }
    } catch (e) {
      console.log("Could not write debug log:", e && e.message);
    }
    // save a screenshot for later inspection
    try {
      const shot = `screenshot_${Date.now()}.png`;
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      console.log("Saved screenshot:", shot);
    } catch (e) {}
    // Verify whether we reached the original long URL (if mapping exists)
    try {
      const mapPath = "shorts_map.json";
      if (fs.existsSync(mapPath)) {
        const m = JSON.parse(fs.readFileSync(mapPath, "utf8"));
        const original = m[shortUrl];
        if (original) {
          const ok =
            (afterUrl && afterUrl.includes(original)) ||
            (afterUrl && afterUrl.includes(new URL(original).host));
          console.log("Original target:", original, "-> reached?", !!ok);
        }
      }
    } catch (e) {}
  } catch (err) {
    console.log("visit error:", err && err.message);
  } finally {
    await browser.close().catch(() => {});
  }
}

const DEFAULT_TEST_LINK = (() => {
  try {
    const s = fs.readFileSync(new URL("./shorts.json", import.meta.url));
    const arr = JSON.parse(s.toString());
    if (Array.isArray(arr) && arr.length) return arr[0];
  } catch (e) {}
  return "https://babylinks.in/FKthHKw";
})();

const link = process.env.SINGLE_LINK || process.argv[2] || DEFAULT_TEST_LINK;

visitSingle(link)
  .then(() => console.log("Done"))
  .catch((e) => console.error(e));
