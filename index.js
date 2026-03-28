import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "node:fs";
import {
  LONG_URLS,
  USER_AGENTS,
  INDIAN_NAMES,
  EMAIL_DOMAINS,
  TOTAL_RUNS,
  MIN_DELAY_MIN,
  MAX_DELAY_MIN,
} from "./lib/config.js";
import { getProxies } from "./lib/proxyProvider.js";
import {
  randomItem,
  randomDelayMs,
  simulateHuman,
  bypassObstacles,
  tryLead,
  sleep,
} from "./lib/utils.js";
import { generateShortLinks } from "./lib/shortener.js";

puppeteer.use(StealthPlugin());

let PROXIES = [];

async function visitLink(shortUrl) {
  let proxy = undefined;
  if (process.env.NO_PROXY !== "1") proxy = randomItem(PROXIES) || undefined;
  console.log(`Visiting ${shortUrl} | Proxy: ${proxy || "direct"}`);

  const launchArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--window-size=1366,768",
  ];
  if (proxy) launchArgs.push(`--proxy-server=${proxy}`);

  let browser = null;
  let page = null;
  let finalUrl = null;
  let lead = false;
  let bypassMethod = null;

  // attempt launch (may fail with bad proxies)
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: launchArgs,
      timeout: 60000,
    });
  } catch (err) {
    console.log("Browser launch with proxy failed:", err && err.message);
    // Retry without proxy
    try {
      const launchArgsNoProxy = launchArgs.filter(
        (a) => !a.startsWith("--proxy-server"),
      );
      browser = await puppeteer.launch({
        headless: true,
        args: launchArgsNoProxy,
        timeout: 60000,
      });
      console.log("Retried launch without proxy — continuing direct");
    } catch (err2) {
      console.log("Browser launch retry failed:", err2 && err2.message);
      throw err2;
    }
  }

  try {
    page = await browser.newPage();
    await page.setUserAgent(randomItem(USER_AGENTS));
    await page.setViewport({
      width: 1280 + Math.floor(Math.random() * 400),
      height: 720 + Math.floor(Math.random() * 300),
    });

    // capture network requests that look like click/track events so we can verify provider registration
    const trackingRequests = [];
    const trackingRequestsDetailed = [];
    const trackFilter = (u) => {
      if (!u) return false;
      return /nowshort|click|track|register|portalresult|livebiz|loan\.brilliantbihar|gujexpress|safeframe/i.test(
        u,
      );
    };
    page.on("requestfinished", (req) => {
      try {
        const u = req.url();
        if (trackFilter(u)) trackingRequests.push(u);
      } catch (e) {}
    });
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
          trackingRequestsDetailed.push({
            type: "response",
            url: res.url(),
            status: res.status(),
            headers: res.headers(),
          });
        } catch (e) {}
      });
    }

    // navigate
    const resp = await page
      .goto(shortUrl, { waitUntil: "domcontentloaded", timeout: 45000 })
      .catch(() => null);
    await randomDelayMs(1000, 1400);
    try {
      finalUrl = resp ? resp.url() : null;
      console.log("Response URL:", finalUrl || "(no response)");
    } catch (e) {
      // ignore
    }
    try {
      console.log("Page URL:", page.url());
    } catch (e) {
      // ignore
    }

    // capture debug artifacts when single link mode
    if (process.env.SINGLE_LINK) {
      try {
        await page
          .screenshot({ path: "debug_screenshot.png", fullPage: true })
          .catch(() => {});
        const html = await page.content().catch(() => "");
        try {
          fs.writeFileSync("debug_page.html", html);
        } catch (e) {}
        console.log("Saved debug_screenshot.png and debug_page.html");
      } catch (e) {}
    }

    await simulateHuman(page);
    bypassMethod = await bypassObstacles(page);

    // If mapping exists, attempt direct navigate to mapped original first (faster and deterministic)
    try {
      const mapPath = "shorts_map.json";
      if (fs.existsSync(mapPath)) {
        const raw = fs.readFileSync(mapPath, "utf8");
        const map = JSON.parse(raw || "{}");
        const target = map[shortUrl] || map[shortUrl.trim()];
        if (target) {
          try {
            const targetHost = new URL(target).hostname;
            if (!(finalUrl && finalUrl.includes(targetHost))) {
              console.log(
                "Mapping present — navigating directly to mapped original:",
                target,
              );
              await page
                .goto(target, { waitUntil: "domcontentloaded", timeout: 20000 })
                .catch(() => {});
              await randomDelayMs(600, 1500);
              finalUrl = (await page.url().catch(() => finalUrl)) || finalUrl;
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    // If direct navigate didn't resolve, try candidate traversal that may require clicking deeper links
    try {
      const { followMappedTarget } = await import("./lib/utils.js");
      const mappedFinal = await followMappedTarget(page, shortUrl);
      if (mappedFinal) {
        console.log("Mapped follow reached final target:", mappedFinal);
        finalUrl = mappedFinal;
      }
    } catch (e) {
      // ignore
    }

    // inspect frames and detect chrome-error indicating proxy/network issues
    let frames = [];
    try {
      frames = page.frames();
      for (const f of frames) {
        try {
          console.log(`Frame: ${f.url()}`);
        } catch (e) {}
      }
    } catch (e) {}

    const sawChromeError = frames.some((f) =>
      (f.url() || "").startsWith("chrome-error://"),
    );
    if (sawChromeError && proxy) {
      console.log(
        "Detected chrome-error frame (likely bad proxy). Retrying without proxy...",
      );
      try {
        await browser.close().catch(() => {});
      } catch (e) {}
      const launchArgsNoProxy = launchArgs.filter(
        (a) => !a.startsWith("--proxy-server"),
      );
      browser = await puppeteer.launch({
        headless: true,
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
      console.log("Page URL:", page.url());
      // attempt bypass again after relaunch
      await simulateHuman(page);
      const bypassMethod2 = await bypassObstacles(page);
      if (!bypassMethod) bypassMethod = bypassMethod2;
    }

    await page.waitForNavigation({ timeout: 5000 }).catch(() => {});

    // wait a short while for any tracking requests that indicate the provider recorded the click
    const waitedUntil = Date.now() + 6000;
    while (Date.now() < waitedUntil) {
      if (trackingRequests && trackingRequests.length > 0) break;
      await sleep(200).catch(() => {});
    }

    try {
      finalUrl = page.url() || finalUrl;
    } catch (e) {
      // ignore
    }
    console.log("After bypass URL:", finalUrl);
    if (trackingRequests && trackingRequests.length > 0) {
      console.log("Observed tracking requests:", trackingRequests.slice(0, 10));
    } else {
      console.log(
        "No tracking requests observed for this visit (may not register in provider dashboard)",
      );
    }

    if (process.env.HAR_CAPTURE === "1") {
      try {
        fs.writeFileSync(
          "last_run_har.json",
          JSON.stringify(trackingRequestsDetailed, null, 2),
        );
        console.log("Wrote last_run_har.json (HAR-like capture)");
      } catch (e) {
        console.log("Failed to write HAR:", e && e.message);
      }
    }

    await simulateHuman(page);
    lead = await tryLead(page, INDIAN_NAMES, EMAIL_DOMAINS);
    if (!lead) console.log("No form → click counted");

    await randomDelayMs(3000, 8000);

    // write debug_runs.log
    try {
      const record = {
        ts: new Date().toISOString(),
        shortUrl,
        landed: finalUrl || null,
        lead: !!lead,
      };
      fs.appendFileSync("debug_runs.log", JSON.stringify(record) + "\n");
    } catch (e) {
      console.log("Could not write debug log:", e && e.message);
    }
  } catch (err) {
    console.log("visitLink caught error:", err && err.message);
  } finally {
    try {
      await browser.close().catch(() => {});
    } catch (e) {}
  }

  return { finalUrl, lead };
}

async function main() {
  console.log("Starting god-bot...");

  try {
    // If NO_PROXY=1 is set, skip fetching/verifying proxies entirely (fast startup)
    if (process.env.NO_PROXY === "1") {
      console.log(
        "NO_PROXY=1 -> skipping proxy fetch and using direct connections",
      );
      PROXIES = [];
    } else {
      const verify = process.env.VERIFY_PROXIES === "1";
      const maxVerify =
        process.env.MAX_VERIFY ? parseInt(process.env.MAX_VERIFY, 10) : 30;
      const concurrency =
        process.env.PROXY_CONC ? parseInt(process.env.PROXY_CONC, 10) : 6;
      const cacheTtl =
        process.env.PROXY_CACHE_TTL ?
          parseInt(process.env.PROXY_CACHE_TTL, 10)
        : 1000 * 60 * 30;

      // If VERIFY_PROXIES=1 then actively verify up to `maxVerify` proxies, otherwise prefer cached set
      const p = await getProxies({
        verify: verify,
        maxVerify: verify ? maxVerify : 20,
        concurrency,
        cacheTtl,
      });
      if (p.length > 0) {
        PROXIES = p;
        console.log(`Loaded ${PROXIES.length} proxies from Proxifly`);
      } else {
        console.log("No external proxies loaded — using direct connections");
      }
    }
  } catch (err) {
    console.log("Proxy fetch error — continuing without proxies");
  }

  // Generate or load short links
  let shortLinks = [];
  if (process.env.SKIP_SHORTEN === "1") {
    console.log(
      "SKIP_SHORTEN=1 -> skipping shortening; trying to load shorts.json if present",
    );
    try {
      if (fs.existsSync("shorts.json")) {
        shortLinks = JSON.parse(fs.readFileSync("shorts.json", "utf8"));
        console.log(`Loaded ${shortLinks.length} short links from shorts.json`);
      } else {
        console.log("shorts.json not found and shortening skipped — exiting");
        return;
      }
    } catch (e) {
      console.log("Failed to load shorts.json:", e && e.message);
      return;
    }
  } else {
    console.log(`Generating short links for ${LONG_URLS.length} long URLs...`);
    shortLinks = await generateShortLinks(LONG_URLS);
    if (!shortLinks || shortLinks.length === 0) {
      console.log("No short links generated → add LONG_URLS or check keys");
      return;
    }
    console.log(`Generated ${shortLinks.length} short links`);
  }

  // DEBUG: run a single supplied link and exit
  if (process.env.SINGLE_LINK) {
    console.log("SINGLE_LINK mode — visiting:", process.env.SINGLE_LINK);
    await visitLink(process.env.SINGLE_LINK);
    console.log("SINGLE_LINK run complete");
    return;
  }

  if (!fs.existsSync("leads.csv"))
    fs.writeFileSync("leads.csv", "timestamp,name,email,landing_url\n");

  for (let i = 1; i <= TOTAL_RUNS; i++) {
    const link = randomItem(shortLinks);
    console.log(`\nRun ${i}/${TOTAL_RUNS} → ${link}`);

    const { finalUrl, lead } = await visitLink(link);
    // append a record for this visit
    try {
      const ts = new Date().toISOString();
      const name = lead ? "LEAD_SUBMITTED" : "";
      const email = lead ? "" : "";
      const landing = finalUrl || "";
      fs.appendFileSync("leads.csv", `${ts},${name},${email},${landing}\n`);
    } catch (e) {
      console.log("Failed to write leads.csv:", e && e.message);
    }

    if (i < TOTAL_RUNS) {
      const capMaxMin =
        process.env.REDUCE_MAX_MIN ? parseFloat(process.env.REDUCE_MAX_MIN) : 5;
      const effectiveMax = Math.max(
        Math.min(MAX_DELAY_MIN, capMaxMin),
        MIN_DELAY_MIN,
      );
      const effectiveMin = Math.min(MIN_DELAY_MIN, effectiveMax);
      const delayMin =
        effectiveMin + Math.random() * (effectiveMax - effectiveMin);
      const delaySec = Math.round(delayMin * 60);
      console.log(
        `Waiting ~${delaySec} seconds (${delayMin.toFixed(2)} min) — cap ${capMaxMin} min`,
      );
      await randomDelayMs(delaySec * 1000 * 0.9, delaySec * 1000 * 1.1);
    }
  }

  console.log("\nFinished all runs. Check shorts.json & leads.csv");
}

main().catch((err) => console.error("Fatal:", err));
