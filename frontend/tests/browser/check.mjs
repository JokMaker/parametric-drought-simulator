// Browser checks in headless Chrome, driven over the DevTools protocol (no packages):
//   1. every page at phone, tablet and desktop widths, in light and dark mode:
//      no console errors, no uncaught exceptions, no sideways scrolling;
//   2. the main flows: policy lookup, the area field, the USSD menu;
//   3. page-load timings, optionally on a throttled "low-end phone" profile.
//
// Needs the frontend (and the backend, for live data) running:
//   node tests/browser/check.mjs                      # against http://localhost:3000
//   BASE=http://localhost:3100 THROTTLE=1 node tests/browser/check.mjs
// Writes a JSON report to tests/browser/results.json and screenshots to SHOTS if set.
// Nothing is written to the backend: no SMS is sent and no loss report is saved.

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const THROTTLE = process.env.THROTTLE === "1";
const SHOTS = process.env.SHOTS;
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9400 + Math.floor(Math.random() * 500);

const PAGES = ["/", "/season", "/map", "/explorer", "/history", "/basis-risk", "/field-checks", "/pricing", "/farmer", "/policies", "/term-sheet", "/ussd"];
const VIEWPORTS = [
  { name: "phone", width: 360, height: 780, mobile: true, scale: 3 },
  { name: "tablet", width: 768, height: 1024, mobile: true, scale: 2 },
  { name: "desktop", width: 1280, height: 800, mobile: false, scale: 1 },
];
// Chrome DevTools' "Slow 4G" preset with a 4x slower CPU: a mid-range Android phone.
const LOW_END = { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, cpu: 4 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${join(tmpdir(), `rdi-check-${Date.now()}`)}`, "about:blank"], { stdio: "ignore" });

let ws;
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page");
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch { /* Chrome is still starting */ }
  if (!ws) await sleep(250);
}
if (ws.readyState !== WebSocket.OPEN) await new Promise((r) => ws.addEventListener("open", r));

let nextId = 0;
const pending = new Map();
const problems = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  } else if (m.method === "Runtime.exceptionThrown") {
    problems.push(`exception: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
  } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    problems.push(`console.error: ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`);
  } else if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
    problems.push(`${m.params.entry.source}: ${m.params.entry.text} ${m.params.entry.url ?? ""}`.trim());
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};

await Promise.all([send("Page.enable"), send("Runtime.enable"), send("Log.enable"), send("Network.enable")]);
// A headless window never has focus, so focus and blur events would not fire without this.
await send("Emulation.setFocusEmulationEnabled", { enabled: true });
await send("Network.setCacheDisabled", { cacheDisabled: true });
// Largest Contentful Paint, recorded from the start of every page load.
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: "window.__lcp = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });",
});

async function setViewport(v, dark) {
  await send("Emulation.setDeviceMetricsOverride", { width: v.width, height: v.height, deviceScaleFactor: v.scale, mobile: v.mobile });
  await send("Emulation.setTouchEmulationEnabled", { enabled: v.mobile });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }] });
}

async function open(path) {
  const loaded = new Promise((r) => {
    const onLoad = (e) => { if (JSON.parse(e.data).method === "Page.loadEventFired") { ws.removeEventListener("message", onLoad); r(); } };
    ws.addEventListener("message", onLoad);
  });
  const started = Date.now();
  await send("Page.navigate", { url: BASE + path });
  await Promise.race([loaded, sleep(30_000)]);
  if (process.env.VERBOSE) console.error(`  ${path} ${Date.now() - started} ms`);
  // Wait for the data to arrive: no loading placeholders left, then a short settle.
  for (let i = 0; i < 40; i++) {
    if (!(await evaluate("!!document.querySelector('[aria-busy=\"true\"], .animate-pulse')"))) break;
    await sleep(250);
  }
  await sleep(600);
}

// Elements wider than the viewport, which force sideways scrolling on a phone.
const OVERFLOW = `(() => {
  const w = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth <= w + 1) return null;
  const wide = [...document.querySelectorAll('body *')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.right > w + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('[class*="overflow-x-auto"], [class*="overflow-auto"], [class*="overflow-hidden"]');
  });
  const leaf = wide.filter((el) => !wide.some((o) => o !== el && el.contains(o)));
  return { scrollWidth: document.documentElement.scrollWidth, width: w,
    elements: leaf.slice(0, 3).map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 3).join('.') : '')) };
})()`;

const report = { base: BASE, date: new Date().toISOString(), chrome: (await send("Browser.getVersion")).product, layout: [], flows: [], timings: [] };
const failures = [];

// 1. Layout and errors on every page, viewport and theme.
for (const v of VIEWPORTS) {
  for (const dark of [false, true]) {
    await setViewport(v, dark);
    console.error(`${v.name}, ${dark ? "dark" : "light"}`);
    for (const path of PAGES) {
      problems.length = 0;
      await open(path);
      const overflow = await evaluate(OVERFLOW);
      const empty = await evaluate("document.querySelector('main')?.innerText.trim().length < 50");
      const row = { page: path, viewport: v.name, theme: dark ? "dark" : "light", errors: [...problems], overflow, empty };
      report.layout.push(row);
      if (row.errors.length || overflow || empty) failures.push(`${path} ${v.name} ${row.theme}: ${JSON.stringify({ errors: row.errors, overflow, empty })}`);
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true });
        const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
        writeFileSync(join(SHOTS, `${path === "/" ? "overview" : path.slice(1)}-${v.name}-${row.theme}.png`), Buffer.from(data, "base64"));
      }
    }
  }
}

// 2. The main flows, at phone width (the hardest case).
await setViewport(VIEWPORTS[0], false);
const text = () => evaluate("document.querySelector('main').innerText");
const type = (selector, value) => evaluate(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  el.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
const click = (label) => evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)}).click()`);

async function flow(name, steps) {
  problems.length = 0;
  try {
    await steps();
    if (problems.length) throw new Error(problems.join("; "));
    report.flows.push({ name, ok: true });
  } catch (e) {
    report.flows.push({ name, ok: false, error: e.message });
    failures.push(`flow "${name}": ${e.message}`);
  }
}
const expect = (ok, message) => { if (!ok) throw new Error(message); };

await flow("Farmer View: look up a policy by number, any case", async () => {
  await open("/farmer");
  await type("#policy", "rdi-kay-1085");
  await sleep(500);
  const t = await text();
  expect(t.includes("Kayonza") && !t.includes("No policy"), "Kayonza policy not shown");
});

await flow("Farmer View: unknown policy number shows a message", async () => {
  await type("#policy", "RDI-XXX-0000");
  await sleep(300);
  expect((await text()).includes("No policy RDI-XXX-0000"), "no not-found message");
});

await flow("Farmer View: area accepts typing and clamps on blur", async () => {
  await type("#policy", "RDI-RWA-1233");
  await sleep(300);
  await type("#area", "1");
  await sleep(100);
  expect((await evaluate("document.querySelector('#area').value")) === "1", "typing was clamped mid-keystroke");
  await type("#area", "1250");
  await evaluate("document.querySelector('#area').blur()");
  await sleep(200);
  expect((await evaluate("document.querySelector('#area').value")) === "1250", "1250 m2 not kept");
  await type("#area", "10");
  await evaluate("document.querySelector('#area').blur()");
  await sleep(200);
  expect((await evaluate("document.querySelector('#area').value")) === "50", "10 m2 not raised to the 50 m2 minimum");
});

await flow("Farmer View: the payout SMS is one SMS in English and Kinyarwanda", async () => {
  for (const lang of ["English", "Kinyarwanda"]) {
    await click(lang);
    await sleep(200);
    const count = (await text()).match(/(\d+) SMS · (\d+) chars/);
    expect(count && count[1] === "1", `${lang}: ${count ? count[0] : "no SMS count shown"}`);
  }
});

// The on-screen phone: type an answer, press Send, wait for the backend's reply.
const ussdReply = async (input) => {
  await type('[aria-label="Phone input"]', input);
  await click("Send");
  for (let i = 0; i < 20; i++) {
    await sleep(200);
    if (!(await evaluate("document.querySelector('button[disabled]') !== null"))) break;
  }
  return evaluate("document.querySelector('[aria-live]').innerText");
};

await flow("USSD: dial, open each screen, go back, switch language", async () => {
  await open("/ussd");
  const reply = ussdReply;
  expect((await reply("*384*44698#")).includes("1. Ubwishingizi bwanjye"), "Kinyarwanda menu not shown after dialling");
  expect((await reply("1")).includes("Agaciro kishingiwe"), "cover screen missing");
  expect((await reply("0")).includes("2. Iki gihembwe"), "0 did not go back to the menu");
  expect((await reply("5")).includes("1. My cover"), "5 did not switch to English");
  expect((await reply("3")).includes("Your payouts"), "payouts screen missing");
  expect((await reply("0")).includes("4. Report a crop loss"), "0 did not go back from payouts");
  expect((await reply("5")).includes("Ubwishingizi bwanjye"), "5 did not switch back to Kinyarwanda");
  expect((await reply("2")).includes("Igihembwe A"), "season screen missing in Kinyarwanda");
});

await flow("USSD sign-up: new farmer, a wrong answer, then the quote (not confirmed)", async () => {
  await open("/ussd");
  // Choose "A new farmer" (React listens for the change event), then a fresh demo number.
  await evaluate(`(() => {
    const select = document.querySelector('select');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'new');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await sleep(200);
  await click("Use a new number");
  await sleep(200);
  expect((await ussdReply("*384*44698#")).includes("1. Gura ubwishingizi"), "sign-up menu not shown for a new number");
  expect((await ussdReply("1")).includes("7. Rwamagana"), "district list missing");
  expect((await ussdReply("9")).includes("Igisubizo ntikemewe"), "district 9 was not rejected");
  expect((await ussdReply("3")).includes("Kayonza"), "Kayonza not chosen after the wrong answer");
  const quote = await ussdReply("1250");
  expect(quote.includes("Kayonza, 1,250 m2") && quote.includes("Umusanzu RWF"), "no premium quote");
  // Stop here: confirming would save a policy in the real database.
  expect((await ussdReply("0")).includes("Andika ubuso"), "0 did not go back from the quote");
});

await flow("Pricing: all seven districts priced", async () => {
  await open("/pricing");
  const t = await text();
  const missing = ["Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"].filter((d) => !t.includes(d));
  expect(!missing.length, `missing ${missing.join(", ")}`);
});

// 3. Page-load timings: desktop, then (THROTTLE=1) a low-end phone on a slow network.
const profiles = [{ name: "desktop, no throttling", viewport: VIEWPORTS[2] }];
if (THROTTLE) profiles.push({ name: "phone, Slow 4G, 4x CPU", viewport: VIEWPORTS[0], throttle: LOW_END });
for (const p of profiles) {
  await setViewport(p.viewport, false);
  await send("Network.emulateNetworkConditions", p.throttle
    ? { offline: false, latency: p.throttle.latency, downloadThroughput: p.throttle.downloadThroughput, uploadThroughput: p.throttle.uploadThroughput }
    : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await send("Emulation.setCPUThrottlingRate", { rate: p.throttle?.cpu ?? 1 });
  for (const path of PAGES) {
    await open(path);
    const t = await evaluate(`(() => {
      const n = performance.getEntriesByType('navigation')[0];
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      const bytes = performance.getEntriesByType('resource').reduce((s, r) => s + r.transferSize, n.transferSize);
      return { ttfb: n.responseStart, fcp: fcp?.startTime ?? null, lcp: window.__lcp || null, domContentLoaded: n.domContentLoadedEventEnd, load: n.loadEventEnd, kb: Math.round(bytes / 1024) };
    })()`);
    const round = Object.fromEntries(Object.entries(t).map(([k, x]) => [k, x === null ? null : Math.round(x)]));
    report.timings.push({ profile: p.name, page: path, ...round });
  }
}
await send("Emulation.setCPUThrottlingRate", { rate: 1 });

const out = new URL("./results.json", import.meta.url);
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");

const checks = report.layout.length;
console.log(`${report.chrome}, ${BASE}`);
console.log(`Layout: ${checks - report.layout.filter((r) => r.errors.length || r.overflow || r.empty).length}/${checks} page-viewport-theme checks clean`);
console.log(`Flows: ${report.flows.filter((f) => f.ok).length}/${report.flows.length} passed`);
for (const p of profiles) {
  console.log(`\nTimings (ms), ${p.name}:`);
  console.table(report.timings.filter((t) => t.profile === p.name).map(({ page, ttfb, fcp, lcp, domContentLoaded, load, kb }) => ({ page, ttfb, fcp, lcp, domContentLoaded, load, kb })));
}
if (failures.length) console.log("\nFailures:\n" + failures.map((f) => `- ${f}`).join("\n"));

chrome.kill();
process.exit(failures.length ? 1 : 0);
