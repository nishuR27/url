import path from "node:path";

export const LONG_URLS = [
  //   "https://pin.it/5g5bij7RR",
  "https://github.com/nishur27",
  // "https://github.com",
  // "https://chatgpt.com",
  // "https://claude.ai",
  //   "https://www.instagram.com/neuralcontrol_media",
];

export const API_KEYS = {
  // get2short: "8c8713984c08289d432bda68d5063d2ba7eae574",
  // babylinks: "3a783477778cdef25c9a97584f8676c9be860a99",
  nowshort: "d1eb8788d6aa6938a4feaa00b652b53055b75745",
  cpm: "7baf8ae0470de69c59e4548d6345d0d90f4277e7",
};

export const TOTAL_RUNS = 50;
// Reduce default run delays to 1-3 minutes for faster retries during testing
export const MIN_DELAY_MIN = 1;
export const MAX_DELAY_MIN = 3;

export const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1",
];

export const INDIAN_NAMES = [
  "Rahul Sharma",
  "Priya Singh",
  "Amit Kumar",
  "Sneha Patel",
  "Vikram Yadav",
  "Anjali Gupta",
  "Rohan Mehta",
  "Pooja Reddy",
  "Arjun Singh",
  "Neha Kapoor",
];

export const EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "rediffmail.com",
];

export const SHORTS_FILE = path.resolve(process.cwd(), "shorts.json");
