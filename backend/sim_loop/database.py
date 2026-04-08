"""
Sim-Loop — Database Connection
"""

import sqlite3
import os
from pathlib import Path
from .models import SCHEMA

DEFAULT_DB_PATH = os.environ.get("SIM_LOOP_DB", str(Path(__file__).parent / "sim-loop.db"))

def get_db(db_path: str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA busy_timeout=5000")
    return db

def init_db(db_path: str = DEFAULT_DB_PATH):
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    db = get_db(db_path)
    db.executescript(SCHEMA)
    db.commit()
    db.close()
