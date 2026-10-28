// The same pages and flows in Safari (WebKit) or Firefox (Gecko), through the W3C
// WebDriver protocol that both browsers' drivers speak.
//   node tests/browser/webdriver.mjs                    # Safari, against http://localhost:3000
//   BROWSER=firefox node tests/browser/webdriver.mjs    # Firefox, headless
// Safari: safaridriver ships with macOS. One-time setup: Safari > Settings > Advanced >
// "Show features for web developers", then Developer > "Allow remote automation".
// Firefox: needs geckodriver (brew install geckodriver).
// Neither driver emulates a phone, and Safari's window cannot be resized when it opens
// full screen, so narrower widths load the page in a same-origin frame of that width:
// CSS breakpoints follow the frame, as they would a phone screen.

import { spawn } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const BROWSER = process.env.BROWSER ?? "safari";
const PORT = 4460 + Math.floor(Math.random() * 100);
const PAGES = ["/", "/season", "/map", "/explorer", "/history", "/basis-risk", "/field-checks", "/pricing", "/farmer", "/policies", "/term-sheet", "/ussd"];
const WIDTHS = [null, 768, 390]; // null: the full window

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DRIVERS = {
  safari: { command: "safaridriver", args: ["-p", String(PORT)], capabilities: { browserName: "safari" } },
  firefox: {
    command: "geckodriver",
    args: ["--port", String(PORT)],
    capabilities: { browserName: "firefox", "moz:firefoxOptions": { args: ["-headless", "-width=1280", "-height=900"] } },
  },
};
const { command, args, capabilities: wanted } = DRIVERS[BROWSER];
const driver = spawn(command, args, { stdio: "ignore" });
await sleep(1000);

async function call(method, path, body) {
  const res = await fetch(`http://localhost:${PORT}${path}`, { method, body: body && JSON.stringify(body), headers: { "Content-Type": "application/json" } });
  const json = await res.json();
  if (json.value?.error) throw new Error(`${json.value.error}: ${json.value.message}`);
  return json.value;
}

const { sessionId, capabilities } = await call("POST", "/session", { capabilities: { alwaysMatch: wanted } });
const s = `/session/${sessionId}`;
const run = (script, ...args) => call("POST", `${s}/execute/sync`, { script, args });

// Errors thrown after the page script starts; WebDriver has no portable console log.
const CATCH = "window.__errors = window.__errors || []; if (!window.__hooked) { window.__hooked = true; addEventListener('error', (e) => __errors.push(e.message)); addEventListener('unhandledrejection', (e) => __errors.push(String(e.reason))); }";

// The document the checks run in: the page itself, or the page inside the frame.
const DOC = "(window.__frame ? __frame.contentDocument : document)";

async function open(path, width = null) {
  if (width) {
    await call("POST", `${s}/url`, { url: BASE + "/__frame-host" });
    await call("POST", `${s}/execute/async`, {
      script: `const [src, width, done] = arguments;
        document.open(); document.write('<!doctype html><body style="margin:0"></body>'); document.close();
        const f = document.createElement('iframe');
        f.style.cssText = 'border:0;height:900px;width:' + width + 'px';
        f.onload = () => { const w = f.contentWindow; w.__errors = []; w.addEventListener('error', (e) => w.__errors.push(e.message)); w.addEventListener('unhandledrejection', (e) => w.__errors.push(String(e.reason))); done(); };
        window.__frame = f; f.src = src; document.body.append(f);`,
      args: [path, width],
    });
  } else {
    await call("POST", `${s}/url`, { url: BASE + path });
    await run(CATCH);
  }
  for (let i = 0; i < 40; i++) {
    if (!(await run(`return !!${DOC}.querySelector('[aria-busy="true"], .animate-pulse')`))) break;
    await sleep(250);
  }
  await sleep(500);
}

const failures = [];
let checks = 0;
for (const width of WIDTHS) {
  let actual;
  for (const path of PAGES) {
    await open(path, width);
    actual = await run(`return ${DOC}.documentElement.clientWidth`);
    checks++;
    const r = await run(`const d = ${DOC}; return {
      overflow: d.documentElement.scrollWidth > d.documentElement.clientWidth + 1,
      empty: (d.querySelector('main')?.innerText.trim().length ?? 0) < 50,
      crashed: /Application error|Unhandled Runtime Error/.test(d.body.innerText),
      errors: d.defaultView.__errors,
    }`);
    if (r.overflow || r.empty || r.crashed || r.errors.length) failures.push(`${path} at ${actual}px: ${JSON.stringify(r)}`);
  }
  console.log(`${width ? `frame ${width}px` : "full window"} (page ${actual}px): done`);
}

const type = (selector, value) => run(`const el = document.querySelector(arguments[0]); el.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, arguments[1]);
  el.dispatchEvent(new Event('input', { bubbles: true }));`, selector, value);
const text = () => run("return document.querySelector('main').innerText");
const flows = [];
async function flow(name, steps) {
  try { await steps(); flows.push(name); } catch (e) { failures.push(`flow "${name}": ${e.message}`); }
}
const expect = (ok, message) => { if (!ok) throw new Error(message); };

await flow("Farmer View policy lookup and area field", async () => {
  await open("/farmer");
  await type("#policy", "rdi-kay-1085");
  await sleep(400);
  expect((await text()).includes("Kayonza"), "Kayonza policy not shown");
  await type("#area", "10");
  await run("document.querySelector('#area').blur()");
  await sleep(200);
  expect((await run("return document.querySelector('#area').value")) === "50", "10 m2 not raised to 50");
});

await flow("USSD menu", async () => {
  await open("/ussd");
  const reply = async (input) => {
    await type('[aria-label="Phone input"]', input);
    await run("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Send').click()");
    await sleep(1200);
    return run("return document.querySelector('[aria-live]').innerText");
  };
  expect((await reply("*384*44698#")).includes("1. Ubwishingizi bwanjye"), "no Kinyarwanda main menu");
  expect((await reply("1")).includes("Agaciro kishingiwe"), "no cover screen");
  expect((await reply("0")).includes("2. Iki gihembwe"), "0 did not go back");
});

await call("DELETE", s);
driver.kill();
console.log(`${capabilities.browserName} ${capabilities.browserVersion}, ${BASE}`);
console.log(`Layout: ${checks - failures.filter((f) => !f.startsWith("flow")).length}/${checks} page-width checks clean`);
console.log(`Flows: ${flows.length}/2 passed`);
if (failures.length) console.log("Failures:\n" + failures.map((f) => `- ${f}`).join("\n"));
process.exit(failures.length ? 1 : 0);
