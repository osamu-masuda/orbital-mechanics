"""
Sim-Loop — Database Connection (PostgreSQL via shared-db)

設計: common/docs/sim-loop-aggregation-design-2026-04-09.md

SHARED_DB_URL 環境変数で接続先を指定。デフォルトは fatty4:15432。
SQLite から PostgreSQL へ移行済み。db_path 引数は後方互換のため残っているが無視される。
"""

import os

import psycopg2
import psycopg2.extras

DEFAULT_SHARED_DB_URL = "postgresql://loop_writer:changeme@192.168.11.4:15432/loop_data"


def _get_url() -> str:
    return os.environ.get("SHARED_DB_URL", DEFAULT_SHARED_DB_URL)


def get_db(db_path: str = None):
    """PostgreSQL 接続を返す。db_path 引数は後方互換のため無視。"""
    return psycopg2.connect(_get_url())


def init_db(db_path: str = None):
    """スキーマは shared-db/init/01-schema.sql で初期化されているため no-op。"""
    pass
