"""Save the API's responses as the dashboard's offline data.

Run after re-running the notebook, so the dashboard shows the same results
with or without the backend:

    python scripts/export_mock.py
"""

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import data  # noqa: E402
from app.main import app  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "frontend" / "lib" / "mock-data.json"

client = TestClient(app)
ds = data.load()
simulations = [
    client.get("/api/simulate", params={"district": d, "season": s}).json()
    for d, s in sorted(ds.seasons)
]
payload = {
    "model": client.get("/api/model").json(),
    "seasons": client.get("/api/seasons").json(),
    "basisRisk": client.get("/api/basis-risk").json(),
    "history": client.get("/api/history").json(),
    "simulations": simulations,
    "geo": client.get("/api/geo/districts").json(),
    "currentSeason": client.get("/api/current-season").json(),
}
OUT.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
print(f"wrote {OUT.relative_to(OUT.parents[2])}: {len(simulations)} simulations, "
      f"{len(payload['history'])} history points, {OUT.stat().st_size / 1024:.0f} KB")
