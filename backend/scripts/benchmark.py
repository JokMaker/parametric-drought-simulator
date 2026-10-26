"""Response times of the API, one request at a time and under concurrent load.

Run against a running server (nothing is written: no SMS, no loss report):

    python scripts/benchmark.py                       # http://localhost:8000
    python scripts/benchmark.py --base http://localhost:8001 --users 50 --requests 2000

Prints the median and 95th-percentile time per endpoint, then the throughput and
error count when --users clients send --requests requests between them.
"""

import argparse
import json
import statistics
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ENDPOINTS = [
    ("GET", "/api/health", None),
    ("GET", "/api/model", None),
    ("GET", "/api/simulate?district=Ngoma&season=2019", None),
    ("GET", "/api/seasons", None),
    ("GET", "/api/history", None),
    ("GET", "/api/basis-risk", None),
    ("GET", "/api/plot-losses", None),
    ("GET", "/api/current-season", None),
    ("GET", "/api/geo/districts", None),
    ("GET", "/api/loss-reports/summary", None),
    ("POST", "/api/ussd/preview", {"text": "3", "policyId": "RDI-RWA-1233"}),
]

# What a farmer's session and a dashboard visit mostly ask for.
LOAD_MIX = [ENDPOINTS[2], ENDPOINTS[10], ENDPOINTS[1], ENDPOINTS[7]]


def request(base: str, method: str, path: str, body: dict | None) -> tuple[float, int, int]:
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(base + path, data=data, method=method, headers={"Content-Type": "application/json"})
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            size = len(res.read())
            status = res.status
    except urllib.error.HTTPError as e:
        size, status = 0, e.code
    except OSError:
        size, status = 0, 0
    return (time.perf_counter() - start) * 1000, status, size


def percentile(values: list[float], p: float) -> float:
    s = sorted(values)
    return s[min(len(s) - 1, round(p / 100 * (len(s) - 1)))]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--repeat", type=int, default=50, help="sequential requests per endpoint")
    ap.add_argument("--users", type=int, default=20, help="concurrent clients in the load test")
    ap.add_argument("--requests", type=int, default=1000, help="total requests in the load test")
    args = ap.parse_args()

    for e in ENDPOINTS[:3]:  # warm up
        request(args.base, *e)

    print(f"One request at a time ({args.repeat} each), {args.base}")
    print(f"{'endpoint':45} {'median ms':>9} {'p95 ms':>7} {'KB':>6}")
    for method, path, body in ENDPOINTS:
        runs = [request(args.base, method, path, body) for _ in range(args.repeat)]
        if any(status != 200 for _, status, _ in runs):
            print(f"{method} {path}: non-200 responses {sorted({s for _, s, _ in runs})}")
            continue
        times = [t for t, _, _ in runs]
        print(f"{method + ' ' + path:45} {statistics.median(times):9.1f} {percentile(times, 95):7.1f} {runs[0][2] / 1024:6.1f}")

    jobs = [LOAD_MIX[i % len(LOAD_MIX)] for i in range(args.requests)]
    start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.users) as pool:
        results = list(pool.map(lambda e: request(args.base, *e), jobs))
    elapsed = time.perf_counter() - start
    times = [t for t, _, _ in results]
    errors = sum(1 for _, status, _ in results if status != 200)
    print(f"\nLoad: {args.users} concurrent clients, {args.requests} requests (simulate, USSD, model, current season)")
    print(f"  {args.requests / elapsed:.0f} requests/s, median {statistics.median(times):.1f} ms, "
          f"p95 {percentile(times, 95):.1f} ms, max {max(times):.1f} ms, errors {errors}")


if __name__ == "__main__":
    main()
