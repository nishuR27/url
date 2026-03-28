import fs from "node:fs";

export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomDelayMs(minMs, maxMs) {
  return new Promise((res) =>
    setTimeout(res, Math.random() * (maxMs - minMs) + minMs),
  );
}

export function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function simulateHuman(page) {
  try {
    const dims = await page.evaluate(() => ({
      w: window.innerWidth,
      h: window.innerHeight,
    }));
    const moves = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < moves; i++) {
      const x = Math.floor(50 + Math.random() * (dims.w - 100));
      const y = Math.floor(50 + Math.random() * (dims.h - 100));
      await page.mouse.move(x, y, { steps: 8 + Math.floor(Math.random() * 6) });
      await randomDelayMs(80, 220);
    }
    // small scrolls
    const scrolls = 1 + Math.floor(Math.random() * 3);
    for (let s = 0; s < scrolls; s++) {
      const dy =
        Math.floor(20 + Math.random() * 200) * (Math.random() > 0.5 ? 1 : -1);
      await page.evaluate(
        (dy) => window.scrollBy({ top: dy, left: 0, behavior: "smooth" }),
        dy,
      );
      await randomDelayMs(120, 350);
    }
  } catch (e) {
    // ignore
  }
}

export async function bypassObstacles(page) {
  const phrases = [
    "continue to destination",
    "continue to website",
    "continue",
    "proceed",
    "next",
    "skip ad",
    "get link",
    "click here",
    "sponsor",
    "sponsor ad",
    "start",
    "close",
    "×",
    "skip",
  ];
  const frames =
    page.frames ? page.frames() : [page.mainFrame ? page.mainFrame() : page];

  const fallbackSelectors = [
    '[aria-label*="close" i]',
    ".close",
    ".btn-close",
    ".skip",
    ".continue-btn",
    ".get-link",
    "#continue",
  ];
  // Try multiple times to follow a chain of continue/next buttons (some shorteners require several steps)
  const maxSteps = 20;
  let steps = 0;

  // Host-specific shortener handling (try quick targeted flows first)
  try {
    const curUrl = await page.url().catch(() => "");
    let hostname = "";
    try {
      hostname = new URL(curUrl).hostname || "";
    } catch (e) {}
    hostname = (hostname || "").toLowerCase();

    if (hostname.includes("nowshort")) {
      try {
        console.log("Detected NowShort — attempting NowShort-specific flow");
        // Click explicit 'Continue to Destination' link if present
        const contXp = `//a[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'continue to destination') or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'continue to destination') or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'continue') and string-length(normalize-space(.))<60]`;
        const contHandles = await page.$x(contXp).catch(() => []);
        if (contHandles && contHandles.length) {
          try {
            await contHandles[0].evaluate((el) =>
              el.scrollIntoView({ block: "center" }),
            );
            // Try native click, fallback to mouse click if needed
            try {
              await contHandles[0].click({ delay: 100 });
            } catch (_) {
              const box = await contHandles[0].boundingBox().catch(() => null);
              if (box)
                await page.mouse.click(
                  box.x + box.width / 2,
                  box.y + box.height / 2,
                  { delay: 90 },
                );
            }
            console.log('Clicked NowShort "Continue to Destination"');

            // Ensure provider registration: if the link has an href, open it in a new page briefly
            try {
              const href = await contHandles[0]
                .evaluate((e) => e.href || e.getAttribute("href"))
                .catch(() => null);
              if (href) {
                try {
                  const br = page.browser();
                  const p2 = await br.newPage();
                  await p2
                    .setViewport({ width: 1000, height: 800 })
                    .catch(() => {});
                  await p2.setUserAgent((await page.userAgent?.()) || "");
                  await p2
                    .goto(href, {
                      waitUntil: "domcontentloaded",
                      timeout: 15000,
                    })
                    .catch(() => {});
                  await randomDelayMs(700, 1700);
                  await p2.close().catch(() => {});
                } catch (e) {}
              }
            } catch (e) {}

            await randomDelayMs(600, 1600);
            await page
              .waitForNavigation({ waitUntil: "networkidle2", timeout: 8000 })
              .catch(() => {});
          } catch (e) {}
        }

        // After navigation, try keyboard tab/enter to trigger focus-based continue buttons
        try {
          for (let t = 0; t < 6; t++) {
            await page.keyboard.press("Tab");
            await randomDelayMs(120, 300);
          }
          await page.keyboard.press("Enter");
          await randomDelayMs(600, 1200);
        } catch (e) {}

        // Scroll and look for 'click here' style buttons or large images to click
        try {
          await page.evaluate(() =>
            window.scrollBy({
              top: window.innerHeight / 2,
              behavior: "smooth",
            }),
          );
          await randomDelayMs(500, 1100);
          const clickXp = `//a[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'click here') or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'click image') or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'click here to continue') or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'get link') or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'continue to destination')]`;
          const clickHandles = await page.$x(clickXp).catch(() => []);
          if (clickHandles && clickHandles.length) {
            try {
              await clickHandles[0].evaluate((el) =>
                el.scrollIntoView({ block: "center" }),
              );
              await clickHandles[0].click({ delay: 120 }).catch(() => {});
              console.log("Clicked NowShort fallback link");
              await randomDelayMs(700, 1600);
              await page
                .waitForNavigation({ waitUntil: "networkidle2", timeout: 8000 })
                .catch(() => {});
            } catch (e) {}
          }

          // Click first few large images if they seem actionable (some flows require image click)
          const imgs = await page.$$("img");
          if (imgs && imgs.length) {
            for (let i = 0; i < Math.min(3, imgs.length); i++) {
              try {
                const b = await imgs[i].boundingBox().catch(() => null);
                if (b && b.width > 60 && b.height > 40) {
                  await page.mouse
                    .click(b.x + b.width / 2, b.y + b.height / 2, {
                      delay: 120,
                    })
                    .catch(() => {});
                  console.log("Clicked large image candidate on NowShort");
                  await randomDelayMs(900, 2200);
                  await page
                    .waitForNavigation({
                      waitUntil: "networkidle2",
                      timeout: 8000,
                    })
                    .catch(() => {});
                  break;
                }
              } catch (e) {}
            }
          }
        } catch (e) {}
      } catch (e) {}
    }

    if (hostname.includes("babylinks")) {
      try {
        console.log(
          "Detected Babylinks — attempting Babylinks-specific selectors",
        );
        const known = [
          ".continue-link",
          "#continue",
          ".btn-continue",
          "a.continue",
          'a[href*="continue"]',
        ];
        for (const sel of known) {
          try {
            const el = await page.$(sel);
            if (el) {
              await el.evaluate((el) => el.scrollIntoView({ block: "center" }));
              await el.click({ delay: 90 }).catch(() => {});
              console.log(`Clicked Babylinks selector ${sel}`);
              await randomDelayMs(700, 1500);
              await page
                .waitForNavigation({ waitUntil: "networkidle2", timeout: 8000 })
                .catch(() => {});
              break;
            }
          } catch (e) {}
        }
      } catch (e) {}
    }
  } catch (e) {}
  for (; steps < maxSteps; steps++) {
    let clicked = false;
    // search frames for phrase elements
    for (const frame of frames) {
      for (const phrase of phrases) {
        try {
          const xp = `//a[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), '${phrase}')] | //button[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), '${phrase}')] | //input[contains(translate(normalize-space(@value),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), '${phrase}')]`;
          const handles = await frame.$x(xp);
          if (handles && handles.length) {
            for (const h of handles) {
              try {
                await h.evaluate((el) =>
                  el.scrollIntoView({ block: "center", inline: "center" }),
                );
                // prefer to open sponsor/ad links in a new tab then return
                const href = await h
                  .evaluate(
                    (e) => e.href || e.getAttribute("href") || e.value || null,
                  )
                  .catch(() => null);
                if (
                  href &&
                  /sponsor|ad|sponsor ad/i.test(phrase + " " + (href || ""))
                ) {
                  try {
                    const br = page.browser();
                    const mainUrl = await page.url().catch(() => null);
                    for (let attempt = 0; attempt < 3; attempt++) {
                      // attempt to click the element first to open any ad/popup
                      try {
                        await h.click({ delay: 80 });
                      } catch (_) {
                        const box = await h.boundingBox().catch(() => null);
                        if (box)
                          await page.mouse.click(
                            box.x + box.width / 2,
                            box.y + box.height / 2,
                            { delay: 90 },
                          );
                      }
                      await randomDelayMs(700, 1800);

                      // if click opened additional pages, close them
                      try {
                        const pages = await br.pages();
                        for (const p of pages) {
                          try {
                            const u = await p.url().catch(() => "");
                            if (
                              p !== page &&
                              u &&
                              !u.startsWith("about:blank")
                            ) {
                              await randomDelayMs(600, 1200);
                              try {
                                await p.close();
                              } catch (e) {}
                            }
                          } catch (e) {}
                        }
                      } catch (e) {}

                      // if main page navigated away, try to go back
                      try {
                        const cur = await page.url().catch(() => null);
                        if (cur && mainUrl && cur !== mainUrl) {
                          try {
                            await page
                              .goBack({ timeout: 5000 })
                              .catch(() => {});
                          } catch (e) {}
                          await randomDelayMs(400, 900);
                          // if still different, force navigate back to mainUrl
                          const cur2 = await page.url().catch(() => null);
                          if (cur2 && mainUrl && cur2 !== mainUrl) {
                            try {
                              await page
                                .goto(mainUrl, {
                                  waitUntil: "domcontentloaded",
                                  timeout: 8000,
                                })
                                .catch(() => {});
                            } catch (e) {}
                          }
                        }
                      } catch (e) {}
                    }
                    console.log(`Opened/clicked sponsor/ad and returned`);
                    // after opening sponsor ads, give main page time to update
                    await randomDelayMs(600, 1500);
                    clicked = true;
                  } catch (e) {}
                } else {
                  try {
                    await h.click({ delay: 80 });
                    console.log(
                      `Clicked bypass element (xpath native): ${phrase}`,
                    );
                    clicked = true;
                  } catch (e) {
                    const box = await h.boundingBox();
                    if (box) {
                      await page.mouse.move(
                        box.x + box.width / 2,
                        box.y + box.height / 2,
                        { steps: 12 },
                      );
                      await page.mouse.click(
                        box.x + box.width / 2,
                        box.y + box.height / 2,
                        { delay: 90 },
                      );
                      console.log(
                        `Clicked bypass element (xpath mouse): ${phrase}`,
                      );
                      clicked = true;
                    }
                  }
                }
                if (clicked) {
                  // give navigation or JS a moment
                  await randomDelayMs(600, 1400);
                  try {
                    await page
                      .waitForNavigation({
                        waitUntil: "networkidle2",
                        timeout: 8000,
                      })
                      .catch(() => {});
                  } catch (e) {}
                  break;
                }
              } catch (e) {
                // ignore single handle errors
              }
            }
          }
        } catch (e) {}
        if (clicked) break;
      }
      if (clicked) break;
    }

    if (clicked) continue; // try next step

    // fallback selectors on main page
    let anyFallback = false;
    for (const sel of fallbackSelectors) {
      try {
        const el = await page.$(sel);
        if (!el) continue;
        anyFallback = true;
        try {
          await el.click({ delay: 100 + Math.random() * 80 });
          console.log(`Clicked bypass element (css native): ${sel}`);
          await randomDelayMs(600, 1200);
          await page
            .waitForNavigation({ waitUntil: "networkidle2", timeout: 8000 })
            .catch(() => {});
          clicked = true;
          break;
        } catch (e) {
          const box = await el.boundingBox();
          if (box) {
            await page.mouse.click(
              box.x + box.width / 2,
              box.y + box.height / 2,
              { delay: 90 },
            );
            console.log(`Clicked bypass element (css mouse): ${sel}`);
            await randomDelayMs(600, 1200);
            await page
              .waitForNavigation({ waitUntil: "networkidle2", timeout: 8000 })
              .catch(() => {});
            clicked = true;
            break;
          }
        }
      } catch (e) {}
      if (clicked) break;
    }
    if (clicked) continue;

    // forced evaluation navigation as last resort
    try {
      const forced = await page.evaluate(() => {
        const phraseRe =
          /continue to destination|continue|proceed|get link|skip ad|next|sponsor|captcha|verify you're human|verify you are human/i;
        const candidates = Array.from(
          document.querySelectorAll("a,button,input"),
        );
        for (const el of candidates) {
          const text = (el.innerText || el.value || "").trim();
          if (phraseRe.test(text)) {
            const href = el.href || el.getAttribute("href") || el.value;
            if (href) {
              try {
                window.location.href = href;
              } catch (e) {}
              return href;
            }
          }
        }
        return null;
      });
      if (forced) {
        console.log("Forced navigation to:", forced);
        await randomDelayMs(700, 1400);
        await page
          .waitForNavigation({ waitUntil: "networkidle2", timeout: 8000 })
          .catch(() => {});
        continue;
      }
    } catch (e) {}

    // if there were timers, wait them out
    try {
      if (page.isClosed && page.isClosed()) return null;
      const text = await page
        .evaluate(() => document.body.innerText)
        .catch(() => "");
      const timer = text.match(/(\d{1,2})\s*(second|sec|seconds)/i);
      if (timer) {
        const sec = parseInt(timer[1]) + 4;
        console.log(`Timer detected → wait ${sec}s`);
        await randomDelayMs(sec * 1000, (sec + 3) * 1000);
        continue;
      }
      // detect Cloudflare / captcha wording
      const cap = text.match(
        /captcha|cloudflare|verify you're human|verify you are human/i,
      );
      if (cap) {
        console.log("CAPTCHA or Cloudflare challenge detected in page text.");
        try {
          // Emit a clear marker for external listeners (control-server/SSE)
          console.log("CAPTCHA_DETECTED");
          const shot = `captcha_${Date.now()}.png`;
          await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
          console.log("CAPTCHA_SCREENSHOT:", shot);
        } catch (e) {}
        // If running headful, give the operator time to solve
        try {
          const isHeadful = process.env.HEADFUL === "1";
          if (isHeadful) {
            console.log(
              "Headful mode — waiting up to 2 minutes for manual solve...",
            );
            const start = Date.now();
            let solved = false;
            while (Date.now() - start < 120000) {
              await randomDelayMs(3000, 5000);
              const t = await page
                .evaluate(() => document.body.innerText)
                .catch(() => "");
              if (
                !/captcha|cloudflare|verify you're human|verify you are human/i.test(
                  t,
                )
              ) {
                solved = true;
                break;
              }
            }
            if (!solved) console.log("Manual solve timeout — proceeding.");
            else continue;
          } else {
            // headless — capture screenshot and bail this chain
            try {
              await page.screenshot({
                path: `captcha_${Date.now()}.png`,
                fullPage: true,
              });
              console.log("Saved captcha screenshot");
            } catch (e) {}
            break;
          }
        } catch (e) {}
      }
    } catch (e) {}

    // if nothing actionable found, try gentle scrolling to reveal hidden buttons
    if (!anyFallback) {
      try {
        await page.evaluate(() =>
          window.scrollBy({ top: window.innerHeight / 2, behavior: "smooth" }),
        );
        await randomDelayMs(700, 1500);
        // also try clicking inside visible iframes
        const iframes = page.frames ? page.frames() : [];
        for (const ff of iframes) {
          try {
            const inner = await ff.evaluate(() => {
              const phrases = [
                "continue",
                "proceed",
                "get link",
                "next",
                "sponsor",
                "skip ad",
              ];
              const re = new RegExp(phrases.join("|"), "i");
              const cands = Array.from(
                document.querySelectorAll("a,button,input"),
              );
              for (const el of cands) {
                const t = (el.innerText || el.value || "").trim();
                if (re.test(t)) {
                  try {
                    el.click();
                  } catch (e) {}
                  return true;
                }
              }
              return false;
            });
            if (inner) {
              await randomDelayMs(500, 1200);
              continue;
            }
          } catch (e) {}
        }
      } catch (e) {}
      break;
    }
  }

  return steps > 0 ? `multi-steps:${steps}` : null;
}

export async function followMappedTarget(page, shortUrl) {
  try {
    const mapPath = "shorts_map.json";
    if (!fs.existsSync(mapPath)) return null;
    const raw = fs.readFileSync(mapPath, "utf8");
    const map = JSON.parse(raw || "{}");
    const target = map[shortUrl] || map[shortUrl.trim()];
    if (!target) return null;
    let targetHost = null;
    try {
      targetHost = new URL(target).hostname;
    } catch (e) {}

    console.log(`Mapped target for ${shortUrl} → ${target}`);

    // Helper to test a candidate href by opening in a new page and waiting for navigation
    const br = page.browser();
    const tryCandidate = async (href) => {
      if (!href || href.startsWith("javascript:") || href.startsWith("data:"))
        return null;
      try {
        const p = await br.newPage();
        await p.setViewport({ width: 1280, height: 800 }).catch(() => {});
        await p.setUserAgent((await page.userAgent?.()) || "");
        const nav = await p
          .goto(href, { waitUntil: "domcontentloaded", timeout: 20000 })
          .catch(() => null);
        await randomDelayMs(800, 1600);
        let final = nav ? nav.url() : await p.url().catch(() => null);
        if (
          final &&
          ((targetHost && final.includes(targetHost)) || final === target)
        ) {
          await p.close().catch(() => {});
          return final;
        }

        // Try to interact on the candidate page: click obvious continue/get-link buttons, images, or tab/enter
        try {
          const phrases = [
            "continue to destination",
            "continue",
            "get link",
            "click here",
            "proceed",
            "next",
            "go to link",
            "verify",
            "get link",
          ];
          for (const ph of phrases) {
            const xp = `//a[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'${ph}')] | //button[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'${ph}')]`;
            const handles = await p.$x(xp).catch(() => []);
            if (handles && handles.length) {
              try {
                await handles[0].evaluate((el) =>
                  el.scrollIntoView({ block: "center" }),
                );
                await handles[0].click({ delay: 120 }).catch(() => {});
                await randomDelayMs(800, 2000);
                await p
                  .waitForNavigation({
                    waitUntil: "domcontentloaded",
                    timeout: 10000,
                  })
                  .catch(() => {});
                final = await p.url().catch(() => final);
                if (
                  final &&
                  ((targetHost && final.includes(targetHost)) ||
                    final === target)
                ) {
                  await p.close().catch(() => {});
                  return final;
                }
              } catch (e) {}
            }
          }

          // Try Tab/Enter presses
          try {
            for (let t = 0; t < 6; t++) {
              await p.keyboard.press("Tab");
              await randomDelayMs(100, 300);
            }
            await p.keyboard.press("Enter");
            await randomDelayMs(700, 1600);
            await p
              .waitForNavigation({
                waitUntil: "domcontentloaded",
                timeout: 8000,
              })
              .catch(() => {});
            final = await p.url().catch(() => final);
            if (
              final &&
              ((targetHost && final.includes(targetHost)) || final === target)
            ) {
              await p.close().catch(() => {});
              return final;
            }
          } catch (e) {}

          // click a few large images
          const imgs = await p.$$("img");
          if (imgs && imgs.length) {
            for (let i = 0; i < Math.min(3, imgs.length); i++) {
              try {
                const b = await imgs[i].boundingBox().catch(() => null);
                if (b && b.width > 60 && b.height > 40) {
                  await p.mouse
                    .click(b.x + b.width / 2, b.y + b.height / 2, {
                      delay: 120,
                    })
                    .catch(() => {});
                  await randomDelayMs(900, 2200);
                  await p
                    .waitForNavigation({
                      waitUntil: "domcontentloaded",
                      timeout: 10000,
                    })
                    .catch(() => {});
                  final = await p.url().catch(() => final);
                  if (
                    final &&
                    ((targetHost && final.includes(targetHost)) ||
                      final === target)
                  ) {
                    await p.close().catch(() => {});
                    return final;
                  }
                }
              } catch (e) {}
            }
          }
        } catch (e) {}

        // Inspect anchors for direct matches
        const anchors = await p
          .$$eval("a", (as) => as.map((a) => a.href).filter(Boolean))
          .catch(() => []);
        for (const a of anchors) {
          if (targetHost && a.includes(targetHost)) {
            await p.close().catch(() => {});
            return a;
          }
        }

        await p.close().catch(() => {});
      } catch (e) {}
      return null;
    };

    // Collect candidate hrefs from main page and frames
    const candidates = new Set();
    try {
      const anchors = await page
        .$$eval("a", (as) => as.map((a) => a.href).filter(Boolean))
        .catch(() => []);
      for (const a of anchors) candidates.add(a);
    } catch (e) {}
    try {
      const frames = page.frames ? page.frames() : [];
      for (const f of frames) {
        try {
          const fa = await f
            .$$eval("a", (as) => as.map((a) => a.href).filter(Boolean))
            .catch(() => []);
          for (const a of fa) candidates.add(a);
        } catch (e) {}
      }
    } catch (e) {}

    // Prioritize candidates that already contain the host or target string
    const prioritized = [];
    const others = [];
    for (const c of candidates) {
      if (!c) continue;
      try {
        if ((targetHost && c.includes(targetHost)) || c === target)
          prioritized.push(c);
        else others.push(c);
      } catch (e) {
        others.push(c);
      }
    }

    // Try prioritized candidates first
    for (const c of prioritized.concat(others)) {
      try {
        console.log("Trying candidate link for mapped target:", c);
        const res = await tryCandidate(c);
        if (res) {
          console.log("Reached mapped target via candidate:", res);
          return res;
        }
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}

export async function tryLead(page, INDIAN_NAMES, EMAIL_DOMAINS) {
  // Form fill / lead submission removed — no forms present in current flows.
  // Keep function for compatibility; always return false.
  return false;
}
