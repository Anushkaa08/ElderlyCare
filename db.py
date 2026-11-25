"""
db.py - SQLite connection and initialization for the ElderlyCare project.

Usage:
    from database.db import get_connection, initialize_database

    initialize_database()                      # once, at application startup

    with get_connection() as conn:             # per request / per operation
        rows = conn.execute("SELECT * FROM patients").fetchall()
"""

from __future__ import annotations

import logging
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

# ---------------------------------------------------------------------------
# Paths (always relative to this file, so it works from any working directory)
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "elderlycare.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"

logger = logging.getLogger(__name__)


class DatabaseError(Exception):
    """Raised when a database or schema-file operation fails."""


@contextmanager
def get_connection(db_path: str | Path = DB_PATH) -> Iterator[sqlite3.Connection]:
    """
    Open a SQLite connection, yield it, then commit/rollback and close it.

    - Creates elderlycare.db automatically if it does not exist.
    - Enables foreign key enforcement for this connection.
    - Commits if the block succeeds, rolls back if it fails.
    - Always closes the connection (no leaks).
    """
    conn = None
    try:
        conn = sqlite3.connect(db_path, timeout=10)
        conn.row_factory = sqlite3.Row          # rows behave like dicts
        conn.execute("PRAGMA foreign_keys = ON;")
        yield conn
        conn.commit()
    except sqlite3.Error as exc:
        if conn is not None:
            conn.rollback()
        logger.error("Database error: %s", exc)
        raise DatabaseError(str(exc)) from exc
    except Exception:
        if conn is not None:
            conn.rollback()
        raise
    finally:
        if conn is not None:
            conn.close()


def initialize_database(
    db_path: str | Path = DB_PATH,
    schema_path: str | Path = SCHEMA_PATH,
) -> None:
    """
    Create the database file (if missing) and run schema.sql.

    Safe to call many times: schema.sql uses CREATE ... IF NOT EXISTS.
    """
    schema_path = Path(schema_path)
    try:
        schema_sql = schema_path.read_text(encoding="utf-8")
    except OSError as exc:
        logger.error("Cannot read schema file %s: %s", schema_path, exc)
        raise DatabaseError(f"Cannot read schema file: {schema_path}") from exc

    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    with get_connection(db_path) as conn:
        conn.executescript(schema_sql)

    logger.info("Database initialized at %s", db_path)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    initialize_database()
    with get_connection() as conn:
        tables = conn.execute(
            "SELECT name FROM sqlite_master "
            "WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
        fk_status = conn.execute("PRAGMA foreign_keys").fetchone()[0]
    print("Database ready:", DB_PATH)
    print("Tables:", [t["name"] for t in tables])
    print("Foreign keys enabled:", bool(fk_status))