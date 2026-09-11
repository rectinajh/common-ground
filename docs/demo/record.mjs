import { chromium } from "playwright-core";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "raw");
const APP = "https://commonground-demo.vercel.app/";
const MERGE_TX =
  "https://shannon-explorer.somnia.network/tx/0x454119d783de1b77594dbb7ecdb1d67a621899e59232663cd8819f8de856ba0e";
const SETTLE_TX =
  "https://shannon-explorer.somnia.network/tx/0x232df62a9d3226aea7fbf0a83ab5fcb247b3c4ec1ebc284678138fbf817db73b";

mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function smoothScroll(page, y, ms = 900) {
  await page.evaluate(
    async ({ y, ms }) => {
      const start = window.scrollY;
      const dist = y - start;
      const steps = Math.max(18, Math.round(ms / 20));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        window.scrollTo(0, start + dist * eased);
        await new Promise((r) => setTimeout(r, ms / steps));
      }
    },
    { y, ms },
  );
}

async function highlight(page, selector) {
  await page.evaluate((sel) => {
    document.querySelectorAll(".rec-hl").forEach((el) => el.classList.remove("rec-hl"));
    const el = document.querySelector(sel);
    if (!el) return;
    el.classList.add("rec-hl");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, selector);
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--disable-gpu-sandbox"],
});

const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: { dir: outDir, size: { width: 1920, height: 1080 } },
});

await context.addInitScript(() => {
  localStorage.setItem("cg-lang", "en");
});

const page = await context.newPage();
await page.addInitScript(() => {
  const style = document.createElement("style");
  style.textContent = `
    .rec-hl { outline: 2px solid #2ef2c4 !important; outline-offset: 6px; }
  `;
  document.documentElement.appendChild(style);
});

// 0:00 hook
await page.goto(new URL("./cards/title.html", import.meta.url).href, { waitUntil: "load" });
await sleep(24000);

// live app
await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 60000 });
await sleep(4000);
await page.addStyleTag({
  content: `.rec-hl { outline: 2px solid #2ef2c4 !important; outline-offset: 6px; border-radius: 16px; }`,
});

await highlight(page, ".judge");
await sleep(8000);

await highlight(page, ".hero");
await sleep(7000);

await highlight(page, ".flow");
await sleep(8000);

const storyTop = await page.evaluate(() => {
  const el = document.querySelector(".story") || document.querySelector("ol.timeline")?.closest("section");
  return el ? el.getBoundingClientRect().top + window.scrollY - 80 : 900;
});
await smoothScroll(page, storyTop, 1100);
await highlight(page, ".story, ol.timeline");
await sleep(10000);

await page.evaluate(() => {
  const items = [...document.querySelectorAll("ol.timeline li, .timeline li")];
  items.forEach((el) => el.classList.remove("rec-hl"));
  items[2]?.classList.add("rec-hl");
  items[3]?.classList.add("rec-hl");
});
await sleep(9000);

await page.evaluate(() => {
  const items = [...document.querySelectorAll("ol.timeline li, .timeline li")];
  items.forEach((el) => el.classList.remove("rec-hl"));
  items[4]?.classList.add("rec-hl");
});
await sleep(8000);

await page.goto(MERGE_TX, { waitUntil: "domcontentloaded", timeout: 60000 });
await sleep(10000);

await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 60000 });
await sleep(2500);
await page.addStyleTag({
  content: `.rec-hl { outline: 2px solid #2ef2c4 !important; outline-offset: 6px; border-radius: 16px; }`,
});
const settleTop = await page.evaluate(() => {
  const items = [...document.querySelectorAll("ol.timeline li, .timeline li")];
  const el = items[5] || items.at(-1);
  return el ? el.getBoundingClientRect().top + window.scrollY - 160 : 1200;
});
await smoothScroll(page, settleTop, 900);
await page.evaluate(() => {
  const items = [...document.querySelectorAll("ol.timeline li, .timeline li")];
  items.forEach((el) => el.classList.remove("rec-hl"));
  (items[5] || items.at(-1))?.classList.add("rec-hl");
});
await sleep(7000);

await page.goto(SETTLE_TX, { waitUntil: "domcontentloaded", timeout: 60000 });
await sleep(9000);

await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 60000 });
await sleep(2000);
await page.addStyleTag({
  content: `.rec-hl { outline: 2px solid #2ef2c4 !important; outline-offset: 6px; border-radius: 16px; }`,
});
const proofTop = await page.evaluate(() => {
  const el = document.querySelector(".proof") || document.querySelector(".tasks");
  return el ? el.getBoundingClientRect().top + window.scrollY - 70 : 1400;
});
await smoothScroll(page, proofTop, 1000);
await highlight(page, ".proof, .tasks");
await sleep(8000);

const barTop = await page.evaluate(() => {
  const el = document.querySelector(".bar") || document.body;
  return el.getBoundingClientRect().top + window.scrollY - 80;
});
await smoothScroll(page, barTop, 800);
await highlight(page, ".bar, .proofLinks");
await sleep(5000);

await page.goto(new URL("./cards/end.html", import.meta.url).href, { waitUntil: "load" });
await sleep(16000);

const video = page.video();
await page.close();
const rawPath = await video.path();
await context.close();
await browser.close();
console.log(rawPath);
