"""Farmers' policies, crop-loss reports and the SMS send log.

A farmer who signs up over USSD gets one policy per phone number. One report per
policy per season counts, so pressing the button twice does not inflate a
district's total.

Two databases hold the same tables. With DATABASE_URL set (in backend/.env or the
environment) the store is Postgres, which the deployed backend uses because the
host's disk is wiped on every restart. Without it the store is a small SQLite file
outside backend/data/ (which holds the notebook's read-only export), git-ignored;
set REPORTS_DB to move it. Tests use SQLite files of their own.
"""

import sqlite3
from abc import ABC, abstractmethod
from collections.abc import Iterator
from contextlib import closing, contextmanager
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path

from .env import setting
from .policies import DISTRICT_CODES, Policy, phone_key

DEFAULT_PATH = Path(__file__).resolve().parent.parent / "var" / "loss_reports.sqlite3"

CAUSES = ("drought", "pests", "flood", "other")

# {id} is each database's own auto-numbered key; the rest is shared.
SCHEMA = """
CREATE TABLE IF NOT EXISTS loss_reports (
    id          {id},
    policy_id   TEXT    NOT NULL,
    district    TEXT    NOT NULL,
    season      INTEGER NOT NULL,
    reported_at TEXT    NOT NULL,
    cause       TEXT,
    UNIQUE (policy_id, season)
);
CREATE TABLE IF NOT EXISTS policies (
    id          {id},
    policy_id   TEXT    UNIQUE,
    phone       TEXT    NOT NULL,
    phone_key   TEXT    NOT NULL UNIQUE,
    district    TEXT    NOT NULL,
    area_m2     INTEGER NOT NULL,
    season      INTEGER NOT NULL,
    premium     DOUBLE PRECISION NOT NULL,
    created_at  TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS sms_log (
    id      {id},
    sent_at TEXT    NOT NULL,
    parts   INTEGER NOT NULL,
    live    INTEGER NOT NULL
)
"""


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


class ReportStore(ABC):
    """The only place that talks to the database: every query lives here, so the
    API, the USSD menu and the SMS gateway work with methods, not SQL. The queries
    are written once, in SQL both databases accept; a subclass only says how to
    connect and how its driver marks a parameter."""

    placeholder = "?"

    @property
    @abstractmethod
    def location(self) -> str:
        """Where the data is, for messages (never includes a password)."""

    @abstractmethod
    def _connection(self) -> Iterator:
        """A connection whose changes are committed when the block ends."""

    def _execute(self, con, query: str, params: tuple = ()):
        return con.execute(query.replace("?", self.placeholder), params)

    # Policies

    def register(self, phone: str, district: str, area_m2: int, season: int, premium: float) -> tuple[Policy, bool]:
        """Store a farmer's policy, numbered after the row (RDI-KAY-5001, ...) so it never
        clashes with a demo policy. A number that already has a policy keeps it: the
        result is that policy and False."""
        if district not in DISTRICT_CODES:
            raise ValueError(f"Unknown district: {district}")
        with self._connection() as con:
            existing = self._policy_where(con, "phone_key = ?", phone_key(phone))
            if existing:
                return existing, False
            row = self._execute(
                con,
                "INSERT INTO policies (phone, phone_key, district, area_m2, season, premium, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
                (phone, phone_key(phone), district, area_m2, season, premium, _now()),
            ).fetchone()
            policy_id = f"RDI-{DISTRICT_CODES[district]}-{5000 + row[0]:04d}"
            self._execute(con, "UPDATE policies SET policy_id = ? WHERE id = ?", (policy_id, row[0]))
            return Policy(policy_id, district, area_m2), True

    def policy_for_phone(self, phone: str) -> Policy | None:
        with self._connection() as con:
            return self._policy_where(con, "phone_key = ?", phone_key(phone))

    def policy(self, policy_id: str) -> Policy | None:
        with self._connection() as con:
            return self._policy_where(con, "policy_id = ?", policy_id)

    def _policy_where(self, con, where: str, value: str) -> Policy | None:
        row = self._execute(con, f"SELECT policy_id, district, area_m2 FROM policies WHERE {where}", (value,)).fetchone()
        return Policy(*row) if row else None

    def policies(self) -> list[dict]:
        """Every registered policy, newest first, with the phone number it belongs to."""
        with self._connection() as con:
            cur = self._execute(
                con, "SELECT policy_id, phone, district, area_m2, season, premium, created_at FROM policies ORDER BY id DESC"
            )
            columns = [c[0] for c in cur.description]
            return [dict(zip(columns, row)) for row in cur.fetchall()]

    # Crop-loss reports

    def add(self, policy_id: str, district: str, season: int, cause: str | None = None) -> bool:
        """Store a report; False if this policy already reported this season."""
        if cause is not None and cause not in CAUSES:
            raise ValueError(f"Unknown cause: {cause}")
        with self._connection() as con:
            cur = self._execute(
                con,
                "INSERT INTO loss_reports (policy_id, district, season, reported_at, cause) VALUES (?, ?, ?, ?, ?)"
                " ON CONFLICT DO NOTHING",
                (policy_id, district, season, _now(), cause),
            )
            return cur.rowcount == 1

    def summary(self) -> list[tuple[str, int, int]]:
        """(district, season, number of reports) for every district-season with a report."""
        with self._connection() as con:
            rows = self._execute(
                con, "SELECT district, season, COUNT(*) FROM loss_reports GROUP BY district, season ORDER BY season, district"
            ).fetchall()
            return [tuple(r) for r in rows]

    def count(self, district: str, season: int) -> int:
        with self._connection() as con:
            return self._execute(
                con, "SELECT COUNT(*) FROM loss_reports WHERE district = ? AND season = ?", (district, season)
            ).fetchone()[0]

    def causes(self, district: str, season: int) -> dict[str, int]:
        """Reports per cause for a district-season (reports without a cause are left out)."""
        with self._connection() as con:
            rows = self._execute(
                con,
                "SELECT cause, COUNT(*) FROM loss_reports WHERE district = ? AND season = ? AND cause IS NOT NULL GROUP BY cause",
                (district, season),
            ).fetchall()
            return dict(rows)

    def clear(self) -> int:
        """Delete every loss report (for resetting a demo); returns how many were removed."""
        with self._connection() as con:
            return self._execute(con, "DELETE FROM loss_reports").rowcount

    # SMS log

    def log_sms(self, parts: int, live: bool) -> None:
        with self._connection() as con:
            self._execute(con, "INSERT INTO sms_log (sent_at, parts, live) VALUES (?, ?, ?)", (_now(), parts, int(live)))

    def live_sms_today(self) -> int:
        """Live SMS parts sent since midnight UTC (the sandbox is free, so it is not counted)."""
        today = datetime.now(UTC).date().isoformat()
        with self._connection() as con:
            return int(self._execute(
                con, "SELECT COALESCE(SUM(parts), 0) FROM sms_log WHERE live = 1 AND sent_at >= ?", (today,)
            ).fetchone()[0])  # Postgres sums as a decimal


class SqliteStore(ReportStore):
    """A file on this computer, created on first use."""

    def __init__(self, path: Path):
        self.path = Path(path)

    @property
    def location(self) -> str:
        return str(self.path)

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(self.path)) as con, con:
            con.executescript(SCHEMA.format(id="INTEGER PRIMARY KEY AUTOINCREMENT"))
            # Files made before the cause column existed get it added; earlier reports keep no cause.
            if "cause" not in {row[1] for row in con.execute("PRAGMA table_info(loss_reports)")}:
                con.execute("ALTER TABLE loss_reports ADD COLUMN cause TEXT")
            yield con


class PostgresStore(ReportStore):
    """A Postgres database (Neon, for the deployed backend). Connections are kept in a
    small pool, because opening one over the internet takes longer than a query and a
    USSD screen makes several. The tables are created on the first connection."""

    placeholder = "%s"

    def __init__(self, url: str):
        from psycopg_pool import ConnectionPool  # only needed when Postgres is used

        self.url = url
        # Give up after a few seconds rather than the default 30: Africa's Talking drops a
        # USSD session that waits about 10 seconds for a reply.
        self.pool = ConnectionPool(url, min_size=1, max_size=5, open=True, timeout=8,
                                   kwargs={"connect_timeout": 5}, check=ConnectionPool.check_connection)
        with self.pool.connection() as con:
            for statement in SCHEMA.format(id="BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY").split(";"):
                con.execute(statement)

    @property
    def location(self) -> str:
        from psycopg.conninfo import conninfo_to_dict

        info = conninfo_to_dict(self.url)
        return f"Postgres database {info.get('dbname', '')} on {info.get('host', '')}"

    @contextmanager
    def _connection(self) -> Iterator:
        with self.pool.connection() as con:
            yield con


@lru_cache
def default_store() -> ReportStore:
    url = setting("DATABASE_URL")
    if url:
        return PostgresStore(url)
    return SqliteStore(Path(setting("REPORTS_DB") or DEFAULT_PATH))
