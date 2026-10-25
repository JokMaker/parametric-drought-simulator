"""Farmers' crop-loss reports, kept in a small SQLite file.

One report per policy per season counts, so pressing the button twice does not
inflate a district's total. The file lives outside backend/data/ (which holds
the notebook's read-only export) and is git-ignored; set REPORTS_DB to move it.
"""

import os
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

DB_PATH = Path(os.environ.get("REPORTS_DB", Path(__file__).resolve().parent.parent / "var" / "loss_reports.sqlite3"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS loss_reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_id   TEXT    NOT NULL,
    district    TEXT    NOT NULL,
    season      INTEGER NOT NULL,
    reported_at TEXT    NOT NULL,
    UNIQUE (policy_id, season)
);
CREATE TABLE IF NOT EXISTS sms_log (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    sent_at TEXT    NOT NULL,
    parts   INTEGER NOT NULL,
    live    INTEGER NOT NULL
)
"""


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.executescript(SCHEMA)
    return con


def add(policy_id: str, district: str, season: int) -> bool:
    """Store a report; False if this policy already reported this season."""
    with closing(_connect()) as con, con:
        cur = con.execute(
            "INSERT OR IGNORE INTO loss_reports (policy_id, district, season, reported_at) VALUES (?, ?, ?, ?)",
            (policy_id, district, season, datetime.now(UTC).isoformat(timespec="seconds")),
        )
        return cur.rowcount == 1


def log_sms(parts: int, live: bool) -> None:
    with closing(_connect()) as con, con:
        con.execute("INSERT INTO sms_log (sent_at, parts, live) VALUES (?, ?, ?)",
                    (datetime.now(UTC).isoformat(timespec="seconds"), parts, int(live)))


def live_sms_today() -> int:
    """Live SMS parts sent since midnight UTC (the sandbox is free, so it is not counted)."""
    today = datetime.now(UTC).date().isoformat()
    with closing(_connect()) as con:
        return con.execute("SELECT COALESCE(SUM(parts), 0) FROM sms_log WHERE live = 1 AND sent_at >= ?", (today,)).fetchone()[0]


def summary() -> list[tuple[str, int, int]]:
    """(district, season, number of reports) for every district-season with a report."""
    with closing(_connect()) as con:
        return con.execute(
            "SELECT district, season, COUNT(*) FROM loss_reports GROUP BY district, season ORDER BY season, district"
        ).fetchall()
