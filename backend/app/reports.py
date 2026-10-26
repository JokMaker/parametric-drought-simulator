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
    cause       TEXT,
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
    # Files made before the cause column existed get it added; earlier reports keep no cause.
    if "cause" not in {row[1] for row in con.execute("PRAGMA table_info(loss_reports)")}:
        con.execute("ALTER TABLE loss_reports ADD COLUMN cause TEXT")
    return con


CAUSES = ("drought", "pests", "flood", "other")


def add(policy_id: str, district: str, season: int, cause: str | None = None) -> bool:
    """Store a report; False if this policy already reported this season."""
    with closing(_connect()) as con, con:
        cur = con.execute(
            "INSERT OR IGNORE INTO loss_reports (policy_id, district, season, reported_at, cause) VALUES (?, ?, ?, ?, ?)",
            (policy_id, district, season, datetime.now(UTC).isoformat(timespec="seconds"), cause),
        )
        return cur.rowcount == 1


def causes(district: str, season: int) -> dict[str, int]:
    """Reports per cause for a district-season (reports without a cause are left out)."""
    with closing(_connect()) as con:
        rows = con.execute(
            "SELECT cause, COUNT(*) FROM loss_reports WHERE district = ? AND season = ? AND cause IS NOT NULL GROUP BY cause",
            (district, season),
        ).fetchall()
    return dict(rows)


def clear() -> int:
    """Delete every loss report (for resetting a demo); returns how many were removed."""
    with closing(_connect()) as con, con:
        return con.execute("DELETE FROM loss_reports").rowcount


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
