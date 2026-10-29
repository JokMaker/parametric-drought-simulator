# Testing

Four kinds of testing, each run with tools that ship with Python, Node or the
browser (no extra test packages). Results below are from 26 October 2026 on a
MacBook Pro (Apple M1 Pro, 32 GB, macOS 26.6.2).

| Strategy | What it checks | How to run | Result |
| --- | --- | --- | --- |
| Backend unit and API tests | Model maths, payouts, every endpoint, loss reports, USSD screens, SMS gateways | `cd backend && pytest` | 70 passed (SQLite and Postgres) |
| Frontend unit tests | Pricing, payout curve, uncertainty, field-check rule, SMS length, colour classes | `cd frontend && npm test` | 33 passed |
| Browser tests (functional and compatibility) | 12 pages × 3 screen sizes × light/dark, plus 7 user flows, in headless Chrome; the pages at 3 widths plus 2 flows in Firefox and Safari | `node frontend/tests/browser/check.mjs`, `node frontend/tests/browser/webdriver.mjs` (`BROWSER=firefox` for Firefox) | Chrome 72/72 checks, 7/7 flows; Firefox 36/36, 2/2; Safari 33/33, 2/2 |
| Performance | API latency and load, page loads on desktop and on a throttled phone | `python backend/scripts/benchmark.py`, `THROTTLE=1 node frontend/tests/browser/check.mjs` | below |

## 1. Unit and API tests

**Backend (pytest, 70 tests).** The tests replace the database with a temporary
one and the SMS provider with a fake that records messages (FastAPI dependency
overrides), so they never send a real SMS. They cover:

- the index model: prediction from rain and NDVI z-scores, the linear payout between the −2% trigger and the −22% exit;
- every API endpoint, including errors (unknown district → 404, bad policy number → 422, SMS not set up → 503);
- loss reports: one report per policy and season, causes, the summary;
- USSD sign-up from a number with no policy: every screen in both languages, wrong answers (district 9, a field under 50 m², letters) repeating the question, nothing saved before the farmer confirms, the policy saved and texted to the caller's own number as one SMS, the same premium quoted and stored, one policy per number in any format, and sign-up still working when SMS is not set up;
- the USSD menu: every screen in both languages (it opens in Kinyarwanda), going back with 0, the language switch, and every screen fits the 182-character USSD limit;
- the database store on both SQLite and Postgres (the same tests, run against a throwaway Postgres schema when `TEST_DATABASE_URL` is set): one policy per number, policy numbering, reports, causes, the live SMS count;
- the SMS gateways: sandbox and live hosts, the live daily limit, single-SMS rule, sender ID, rejected messages.

**Frontend (Node's built-in test runner, 33 tests)**, on the same data the dashboard shows:

- payout curve: zero above the trigger, linear between trigger and exit, full past the exit, never decreasing;
- hit/miss classification of each season against the harvest, with the thresholds themselves counted as poor and paid;
- uncertainty: the ±22.3-point model error, a 50% payout chance exactly at the trigger, 15.9% one error above it;
- pricing: value → cover → fair premium → loading → subsidy, burning cost (premiums equal average claims before loading), the one-in-ten-year loss;
- **cross-check with the backend**: the Pricing page and the USSD menu quote the same premium (RWF 584 for policy RDI-RWA-1233);
- field-check rule, including Ngoma 2019 (a 0.2% payout while 59% of farms lost their harvest → field check);
- SMS length: 160/153 GSM characters, extension characters counting twice, one "•" switching the message to UCS-2 (70 characters);
- policy lookup ignores case and spaces.

## 2. Browser tests: functions and compatibility

`frontend/tests/browser/check.mjs` drives headless Chrome 156 over the DevTools
protocol. Every page is opened at three sizes, each in light and dark mode
(12 × 3 × 2 = 72 checks; 66 before the Policies page was added on 28 October). A check fails on a console error, an uncaught
exception, an empty page, or content wider than the screen (sideways scrolling).

| Size | Viewport | Emulates |
| --- | --- | --- |
| Phone | 360 × 780, touch, 3× pixels | A common low-cost Android phone |
| Tablet | 768 × 1024, touch, 2× pixels | iPad portrait |
| Desktop | 1280 × 800 | Laptop |

User flows, at phone size:

| Flow | Input | Expected |
| --- | --- | --- |
| Farmer View lookup | `rdi-kay-1085` (lower case) | Kayonza policy shown |
| Unknown policy | `RDI-XXX-0000` | "No policy RDI-XXX-0000" message |
| Area field | `1` while typing, then `1250`, then `10` | `1` not clamped mid-typing; 1250 kept; 10 raised to the 50 m² minimum on leaving the box |
| Payout SMS | English and Kinyarwanda | 1 SMS in each language |
| USSD menu | dial, 1, 0, 5, 3, 0, 5, 2 | Kinyarwanda menu, cover, back, English menu, payouts, back, Kinyarwanda menu, season screen |
| USSD sign-up (web) | "A new farmer", new demo number, dial, 1, 9, 3, 1250, 0 | Sign-up menu, district list, district 9 rejected and asked again, Kayonza, premium quote, back to field size. It stops before confirming, so no test policy is saved in the real database |
| Pricing | open page | All seven districts priced |

**Problems found and fixed.**

- **Overview overflowed on phones.** The "What drives the index" chart used fixed columns of 170 px and 150 px, wider than a 360 px phone, so the page scrolled sideways by 29 px. On small screens the label now sits above the bar (`components/charts/InfluenceChart.tsx`).
- **The season strip lost the selected year after a resize** (found by hand in Chrome's device mode). When the screen changed width, for example rotating a phone, the strip kept its old scroll position, so Season A 2023 was selected but the strip showed 2009–2014. The strip now re-centres the selected season whenever its width changes (`components/SeasonTimeline.tsx`).
- **Some text was too faint to read easily** (found by Lighthouse's accessibility audit, then checked on every page in both themes). Grey notes and table headings, red "drought" text, the green "normal" figures and the white text on the red "Field check needed" badge were below the WCAG AA contrast ratio of 4.5:1, some at 2.8:1. The grey, red and green colours were darkened in light mode (grey and green lightened in dark mode), and the badge text now follows the theme. Every text element now passes 4.5:1 (`app/globals.css`).
- **A false failure in the test itself.** The area-field test failed because a headless window never has focus, so blur events did not fire. The test now turns on focus emulation; the field itself was correct.

**Safari (WebKit).** `frontend/tests/browser/webdriver.mjs` drives Safari 26.6.2
through `safaridriver`, which ships with macOS (it needs "Allow remote automation"
switched on once in Safari's Developer settings). Safari cannot emulate a phone,
and its window could not be resized because it opened full screen, so the tablet
and phone widths load each page inside a frame 768 px and 390 px wide (an iPhone
is 390 px); the page's breakpoints follow the frame as they would a phone screen.
The same checks as in Chrome run on all 11 pages at each width, plus the Farmer
View lookup with the area field and the USSD menu (dial, 1, 0).
Result, on the production build: **33/33 page-width checks clean, 2/2 flows passed.** (This ran
on 26 October, before the Policies page existed.)

**Firefox (Gecko).** The same script with `BROWSER=firefox` drives headless Firefox 159
through Mozilla's geckodriver 0.37 (`brew install --cask firefox geckodriver`). Run on 28
October against the live site (https://rdi-maize-insurance.vercel.app), all 12 pages at full
width (1280 px), 768 px and 390 px: **36/36 page-width checks clean, 2/2 flows passed.**

Chrome, Firefox and Safari cover all three browser engines; Chromium and WebKit are behind
almost all phone browsers in Rwanda (Chrome, Samsung Internet, Opera and Edge use Chromium;
every iPhone browser uses WebKit).

## 3. Performance

**API** (`backend/scripts/benchmark.py`, against a local uvicorn server, 50 requests per endpoint):

| Endpoint | Median ms | 95th pct ms | Size KB |
| --- | ---: | ---: | ---: |
| GET /api/health | 0.9 | 3.6 | 0.0 |
| GET /api/model | 1.0 | 4.7 | 1.3 |
| GET /api/simulate | 1.0 | 4.1 | 0.1 |
| GET /api/seasons | 1.2 | 5.2 | 7.9 |
| GET /api/history | 1.5 | 4.0 | 25.5 |
| GET /api/basis-risk | 0.9 | 4.2 | 0.3 |
| GET /api/plot-losses | 1.0 | 3.9 | 4.1 |
| GET /api/current-season | 1.1 | 4.6 | 2.4 |
| GET /api/geo/districts | 1.2 | 3.9 | 58.4 |
| GET /api/loss-reports/summary | 1.4 | 4.8 | 0.1 |
| POST /api/ussd/preview | 1.6 | 4.8 | 0.1 |

Under load (a mix of simulate, USSD, model and current-season requests):

| Concurrent clients | Requests | Throughput | Median | 95th pct | Errors |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 1,000 | 1,956/s | 9.1 ms | 17.6 ms | 0 |
| 100 | 3,000 | 1,960/s | 48.2 ms | 64.9 ms | 0 |

Throughput stays the same from 20 to 100 clients and only waiting time grows: one
server process is the limit, not the code. Africa's Talking expects a USSD reply
within a few seconds, so even at 100 simultaneous users the menu answers well
inside that window.

**Pages** (production build, `next build` + `next start`, cache disabled):

| Page | Desktop LCP ms | Phone FCP ms | Phone LCP ms | Phone load ms | Phone KB |
| --- | ---: | ---: | ---: | ---: | ---: |
| Overview | 28 | 672 | 672 | 2,054 | 400 |
| This Season | 64 | 704 | 2,252 | 1,486 | 291 |
| Map | 24 | 684 | 684 | 1,488 | 400 |
| Explorer | 24 | 684 | 684 | 2,070 | 400 |
| History | 76 | 720 | 2,436 | 2,045 | 417 |
| Basis Risk | 52 | 688 | 2,372 | 2,062 | 385 |
| Field Checks | 60 | 696 | 1,760 | 1,442 | 297 |
| Pricing | 80 | 656 | 2,488 | 2,013 | 416 |
| Farmer View | 68 | 688 | 688 | 1,444 | 309 |
| Term Sheet | 56 | 696 | 1,996 | 1,497 | 298 |
| USSD | 28 | 664 | 664 | 1,427 | 229 |

"Phone" is Chrome's Slow 4G profile (150 ms latency, 1.6 Mbit/s) with the CPU
slowed 4×, close to a mid-range Android phone on a rural connection. FCP is when
the first content appears, LCP when the largest element appears. Google counts an
LCP under 2.5 s as good: every page meets it, the slowest being Pricing at 2.49 s (an earlier run measured 2.51 s, so it sits right at the line).
The pages whose LCP is later than their first paint are waiting for their chart
data from the API, not for the page itself.

**Lighthouse 13.5** (Chrome DevTools, mobile, Moto G Power emulation with Slow 4G,
Incognito window, production build):

| Page | Performance | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Farmer View, before the contrast fix (dev server) | 72 | 97 | 100 | 100 |
| Farmer View, after the fix (production build) | 93 | 100 | 100 | 100 |
| Overview (production build) | 94 | 100 | 100 | 100 |
| Drought Map (production build) | 97 | 100 | 100 | 100 |
| Pricing (production build) | 95 | 100 | 100 | 100 |

The first run was on the development server, which sends unminified code, so its
Performance score is not comparable; its Accessibility audit is what found the
contrast problem described above.

In development mode (`next dev`) the same pages transfer 0.9–1.2 MB and take up to
7 s to settle on the throttled phone, so these figures are only meaningful for the
production build.

**The live deployment** (28 October 2026: dashboard on Vercel, API on Render in Frankfurt,
database on Neon in Frankfurt, measured from Kigali). The same Chrome checks against
https://rdi-maize-insurance.vercel.app: **66/66 page checks clean, 6/6 flows passed** (before the Policies page and the web sign-up flow were added), every page's
largest element painted within 0.8 s (desktop, no throttling; time to first byte 110–210 ms).

| From Kigali to the live API | Time |
| --- | ---: |
| USSD screen, each (Rwanda → Frankfurt and back; the database query itself is a few ms) | 0.43 s |
| USSD screen from the local backend talking to Neon in Frankfurt, before deploying | 0.72 s |
| First request after the database has slept (Neon pauses after 5 idle minutes) | about 2 s |
| First request after the free Render service has slept (15 idle minutes) | about 50 s, avoided by an uptime check every 5 minutes |

**Resource usage** (28 October 2026).

| What | Measured | How |
| --- | ---: | --- |
| API memory, idle | 37 MiB | `docker stats` on the `backend/Dockerfile` image |
| API memory, peak under 100 concurrent clients (3,000 requests, 0 errors) | 45 MiB | the same, during `benchmark.py --users 100` |
| API CPU, peak under that load | 1.2 cores | the same |
| Throughput inside Docker (one worker) | 1,163 requests/s, p95 109 ms | `benchmark.py --base http://localhost:10001` |
| JavaScript per page, pages without charts (Season, Map, Field Checks, Farmer View, Policies, Term Sheet, USSD) | 187–198 KB compressed (586–617 KB unpacked) | sum of each page's `/_next/static` scripts on https://rdi-maize-insurance.vercel.app, Brotli |
| JavaScript per page, chart pages (Overview, Explorer, History, Basis Risk, Pricing) | 305–316 KB compressed (about 1 MB unpacked) | the same; the chart library adds about 120 KB |

The API needs under a tenth of the 512 MB a free Render instance provides. On the throttled
phone profile (1.6 Mbit/s) the heaviest page's scripts take about 1.6 s to download, which is
within the measured LCP of under 2.5 s.

## Reproducing

```bash
# from the repository root
(cd backend && pytest)                                  # 70 tests (2 skipped without TEST_DATABASE_URL)
(cd frontend && npm test)                               # 33 tests

# browser checks, with the backend on :8000 and the frontend on :3000
node frontend/tests/browser/check.mjs                   # layout, flows, desktop timings
node frontend/tests/browser/webdriver.mjs               # Safari, after enabling remote automation
BROWSER=firefox node frontend/tests/browser/webdriver.mjs   # Firefox, with geckodriver installed

# performance, on a production build with its own backend
(cd backend && CORS_ORIGINS=http://localhost:3100 uvicorn app.main:app --port 8001) &
(cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8001 npm run build && npx next start -p 3100) &
BASE=http://localhost:3100 THROTTLE=1 node frontend/tests/browser/check.mjs
python backend/scripts/benchmark.py --base http://localhost:8001
```

Raw browser results are written to `frontend/tests/browser/results.json`.
