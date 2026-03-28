#!/usr/bin/env node
import { getProxies } from "./lib/proxyProvider.js";
import fs from "node:fs";

(async function main() {
  console.log(
    "Fetching and verifying proxies (maxVerify=8) -- this may take a while",
  );
  try {
    const proxies = await getProxies({
      verify: true,
      maxVerify: 8,
      concurrency: 4,
    });
    fs.writeFileSync(
      "verified_proxies.json",
      JSON.stringify({ ts: Date.now(), proxies }, null, 2),
    );
    console.log("Verified proxies written:", (proxies || []).length);
    for (const p of proxies) console.log("- ", p);
  } catch (e) {
    console.error("verify_proxies failed:", e && e.message);
    process.exit(1);
  }
})();
