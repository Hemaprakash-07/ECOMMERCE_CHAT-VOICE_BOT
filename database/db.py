"""
database/db.py
MySQL connection manager using PyMySQL (pure Python – no extra C libs needed).
Use get_db() anywhere in a Flask request context; close_db() is registered
as a teardown so the connection is always released.
"""

import os
import pymysql
import pymysql.cursors
from flask import g, current_app


# ------------------------------------------------------------------
# Connection factory
# ------------------------------------------------------------------
def _connect() -> pymysql.connections.Connection:
    return pymysql.connect(
        host     = os.getenv("MYSQL_HOST", "localhost"),
        port     = int(os.getenv("MYSQL_PORT", 3306)),
        user     = os.getenv("MYSQL_USER", "root"),
        password = os.getenv("MYSQL_PASSWORD", ""),
        database = os.getenv("MYSQL_DB", "ecommerce_chatbot"),
        charset  = "utf8mb4",
        cursorclass = pymysql.cursors.DictCursor,   # rows as dicts
        autocommit  = False,
    )


# ------------------------------------------------------------------
# Per-request helpers
# ------------------------------------------------------------------
def get_db() -> pymysql.connections.Connection:
    """Return (and cache) a DB connection for the current request."""
    if "db" not in g:
        g.db = _connect()
    return g.db


def close_db(e=None):
    """Teardown: close the connection if it was opened this request."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


# ------------------------------------------------------------------
# Flask app registration
# ------------------------------------------------------------------
def init_app(app):
    """Register close_db as an app teardown function."""
    app.teardown_appcontext(close_db)


# ------------------------------------------------------------------
# Convenience query helpers
# ------------------------------------------------------------------
def query_one(sql: str, args=()) -> dict | None:
    """Return the first matching row as a dict, or None."""
    db  = get_db()
    cur = db.cursor()
    cur.execute(sql, args)
    return cur.fetchone()


def query_all(sql: str, args=()) -> list[dict]:
    """Return all matching rows as a list of dicts."""
    db  = get_db()
    cur = db.cursor()
    cur.execute(sql, args)
    return cur.fetchall()


def execute(sql: str, args=(), commit: bool = True) -> int:
    """Execute a DML statement and optionally commit. Returns lastrowid."""
    db  = get_db()
    cur = db.cursor()
    cur.execute(sql, args)
    if commit:
        db.commit()
    return cur.lastrowid
