// ================================================
// GOD-TIER 2026 AUTO CLICK + LEAD + SHORTENER BOT
// For https://babylinks.in / alpha-links.in / get2short.com / inshorturl.com / etc.
// Multi-link rotation, 3–15 min delays, max stealth, Indian focus
// ================================================

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fetch = require('node-fetch');
const fs = require('fs');

puppeteer.use(StealthPlugin());

// ====================== CONFIG ======================
const LONG_URLS = [  // ← Your destination / money pages
  'https://pin.it/5g5bij7RR',
  'https://github.com/lakshya1304',
  'https://babylinks.in/3ARhg',
  'https://babylinks.in',
  'https://alpha-links.in',
  'https://get2short.com',
  'https://lksfy.com',
  'https://inshorturl.com',
  'https://www.instagram.com/neuralcontrol_media',
  'https://nowshort.com',
  'https://makelinks.in',
  'https://get2short.com/DqLV8U1',
  'https://nowshort.com/9rZyx',
  // add more...
];

const API_KEYS = {
  alpha_links:     'PASTE_YOUR_ALPHA_LINKS_API_KEY_HERE',
  get2short:       'c8713984c08289d432bda68d5063d2ba7eae574',
  inshorturl:      'PASTE_YOUR_INSHORTURL_API_KEY_HERE',
  babylinks:       'PASTE_YOUR_BABYLINKS_API_KEY_HERE',
  nowshort:'d1eb8788d6aa6938a4feaa00b652b53055b75745',
  // add lksfy / nowshort / makelinks keys if you get them
};

const PROXIES = [  // ← Residential India proxies (rotating endpoint or list)
  'http://user-zone-resi_country-in:pass@proxy.provider.com:22225',
  // or add more static ones: 'http://user:pass@ip:port',
  // One rotating India proxy is often enough
];

// Number of automated clicks / leads to generate
const TOTAL_RUNS = 50;  // adjust

// Delay between full runs: 3–15 minutes
const MIN_DELAY_MIN = 3;
const MAX_DELAY_MIN = 15;

// ====================== 40+ REALISTIC 2026 USER AGENTS ======================
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Edg/134.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 OPR/113.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  // ... (repeat / vary as needed - script picks random)
];

// 60+ Indian-style names
const INDIAN_NAMES = [
  "Rahul Sharma", "Priya Singh", "Amit Kumar", "Sneha Patel", "Vikram Yadav", "Anjali Gupta",
  "Rohan Mehta", "Pooja Reddy", "Arjun Singh", "Neha Kapoor", "Sanjay Verma", "Kavita Joshi",
  "Manish Thakur", "Riya Desai", "Deepak Nair", "Swati Iyer", "Nikhil Rao", "Aishwarya Menon",
  "Siddharth Banerjee", "Meera Pillai", "Vivek Chatterjee", "Shreya Das", "Karan Malhotra",
  "Divya Choudhary", "Ajay Pandey", "Nisha Saxena", "Rajat Khanna", "Pallavi Bose", "Harsh Tiwari",
  "Ananya Roy", "Prateek Jain", "Simran Kaur", "Abhishek Mishra", "Tanya Sethi", "Mohit Grover",
  "Ishita Batra", "Varun Kapoor", "Sakshi Arora", "Yashvi Aggarwal", "Aditya Rastogi",
  "Muskan Garg", "Kartik Mehra", "Rashi Goel", "Shaurya Kapoor", "Aarohi Sinha", "Reyansh Dubey",
  "Myra Khan", "Advik Trivedi", "Kiara Malhotra", "Aryan Chauhan", "Zara Ansari", "Vihaan Oberoi",
  "Aadhya Jha", "Arnav Seth", "Navya Khurana", "Dhruv Bhatia", "Saisha Grover", "Rudra Shetty"
];

// Legit-looking email domains
const EMAIL_DOMAINS = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "rediffmail.com",
  "yahoo.co.in", "proton.me", "icloud.com", "mail.com", "yandex.com"
];

// ====================== HELPERS ======================
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDelayMs(minMs, maxMs) {
  return new Promise(r => setTimeout(r, Math.random() * (maxMs - minMs) + minMs));
}

async function shortenUrl(longUrl) {
  const paidServices = [
    { name: 'alpha_links', base: 'https://alpha-links.in/api?api=' },
    { name: 'get2short',   base: 'https://get2short.com/api?api=' },
    { name: 'inshorturl',  base: 'https://inshorturl.com/api?api=' },
    { name: 'babylinks',   base: 'https://babylinks.in/api?api='   },
    // Add more if you have keys / different endpoints
  ];

  for (const svc of paidServices) {
    const key = API_KEYS[svc.name];
    if (!key) continue;
    try {
      const url = `\( {svc.base} \){encodeURIComponent(key)}&url=${encodeURIComponent(longUrl)}`;
      const res = await fetch(url);
      const text = await res.text();
      if (text.startsWith('http') && text.length < 100) {
        console.log(`✅ Shortened via ${svc.name}: ${text}`);
        return text.trim();
      }
    } catch (err) {
      console.log(`Paid service ${svc.name} failed: ${err.message}`);
    }
  }

  // Free fallback
  try {
    const res = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`);
    const text = await res.text();
    if (text.startsWith('http')) {
      console.log(`✅ Shortened via is.gd: ${text}`);
      return text.trim();
    }
  } catch {}

  console.log('All shortening failed → skipping this long URL');
  return null;
}

// Generate shorts once at start
async function generateShortLinks() {
  const shorts = [];
  for (const long of LONG_URLS) {
    const short = await shortenUrl(long);
    if (short) shorts.push(short);
    await randomDelayMs(2000, 5000); // polite delay
  }
  if (shorts.length > 0) {
    fs.writeFileSync('shorts.json', JSON.stringify(shorts, null, 2));
    console.log(`Saved ${shorts.length} short links to shorts.json`);
  }
  return shorts;
}

// Human-like behavior
async function simulateHuman(page) {
  await page.evaluate(() => window.scrollBy(0, Math.random() * 600 + 150));
  await randomDelayMs(800, 2200);

  for (let i = 0; i < 5; i++) {
    const x = 200 + Math.random() * 900;
    const y = 150 + Math.random() * 700;
    await page.mouse.move(x, y, { steps: 15 + Math.floor(Math.random() * 15) });
    await randomDelayMs(400, 1200);
  }

  await page.evaluate(() => window.scrollBy(0, Math.random() * 800 + 250));
}

// Bypass timers / ads / continue buttons
async function bypassObstacles(page) {
  const selectors = [
    'text/Continue', 'text/Proceed', 'text/Next', 'text/Skip ad', 'text/Get Link',
    'text/Click Here', 'text/Start', 'button:has-text("Continue")', '[aria-label*="close" i]',
    'text=×', 'text=Close', 'button.close', '[role="button"]:has-text("Skip")'
  ];

  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1800 })) {
        await el.click({ delay: 100 + Math.random() * 80 });
        console.log(`Clicked bypass element: ${sel}`);
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        break;
      }
    } catch {}
  }

  // Timer detection
  const text = await page.evaluate(() => document.body.innerText);
  const timer = text.match(/(\d{1,2})\s*(second|sec|seconds)/i);
  if (timer) {
    const sec = parseInt(timer[1]) + 4;
    console.log(`Timer detected → wait ${sec}s`);
    await randomDelayMs(sec * 1000, (sec + 3) * 1000);
  }
}

// Try fill & submit any form
async function tryLead(page) {
  try {
    const nameSel = 'input[name*="name" i], input[placeholder*="name" i], #name, .name-input, input[id*="name"]';
    const emailSel = 'input[type="email"], input[name*="email" i], input[placeholder*="email" i], #email';
    const submitSel = 'button[type="submit"], input[type="submit"], button:contains("Submit"), button:contains("Send"), #submit, .submit-btn';

    const nameEl = page.locator(nameSel).first();
    if (await nameEl.isVisible({ timeout: 4000 })) {
      const name = randomItem(INDIAN_NAMES) + ' ' + Math.floor(10 + Math.random() * 90);
      const email = `user\( {Date.now().toString().slice(-8)} \){Math.floor(Math.random()*100)}@${randomItem(EMAIL_DOMAINS)}`;

      await nameEl.type(name, { delay: 60 + Math.random()*40 });
      await randomDelayMs(600, 1400);

      const emailEl = page.locator(emailSel).first();
      if (await emailEl.isVisible()) {
        await emailEl.type(email, { delay: 55 + Math.random()*35 });
        await randomDelayMs(700, 1500);
      }

      const submit = page.locator(submitSel).first();
      await submit.click({ delay: 90 });

      console.log(`LEAD: ${name} | ${email}`);
      fs.appendFileSync('leads.csv', `"\( {new Date().toISOString()}"," \){name}","\( {email}"," \){await page.url()}"\n`);

      return true;
    }
  } catch {}
  return false;
}

// One full visit
async function visitLink(shortUrl) {
  const proxy = randomItem(PROXIES) || undefined;
  console.log(`Visiting ${shortUrl} | Proxy: ${proxy || 'direct'}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1366,768',
      proxy ? `--proxy-server=${proxy}` : ''
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent(randomItem(USER_AGENTS));
  await page.setViewport({ width: 1280 + Math.floor(Math.random()*400), height: 720 + Math.floor(Math.random()*300) });

  await page.goto(shortUrl, { waitUntil: 'networkidle2', timeout: 45000 }).catch(e => console.log('Goto timeout ok'));

  await simulateHuman(page);
  await bypassObstacles(page);
  await simulateHuman(page);

  const lead = await tryLead(page);

  if (!lead) console.log('No form → click counted');

  await randomDelayMs(3000, 8000);
  await browser.close();
}

// Main loop
async function main() {
  console.log('Starting god-bot...');

  const shortLinks = await generateShortLinks();
  if (shortLinks.length === 0) {
    console.log('No short links generated → add LONG_URLS or check keys');
    return;
  }

  // Init CSV
  if (!fs.existsSync('leads.csv')) {
    fs.writeFileSync('leads.csv', 'timestamp,name,email,landing_url\n');
  }

  for (let i = 1; i <= TOTAL_RUNS; i++) {
    const link = randomItem(shortLinks);
    console.log(`\nRun \( {i}/ \){TOTAL_RUNS} → ${link}`);

    await visitLink(link);

    if (i < TOTAL_RUNS) {
      const delayMin = MIN_DELAY_MIN + Math.random() * (MAX_DELAY_MIN - MIN_DELAY_MIN);
      const delaySec = Math.round(delayMin * 60);
      console.log(`Waiting \~\( {delaySec} seconds ( \){Math.round(delayMin)} min)`);
      await randomDelayMs(delaySec * 1000 * 0.9, delaySec * 1000 * 1.1);
    }
  }

  console.log('\nFinished all runs. Check shorts.json & leads.csv');
}

main().catch(err => console.error('Fatal:', err));
