# INTERN NOTE: Factory pattern for database engine creation
# This lets us swap between SQLite (dev) and PostgreSQL (prod)
# by only changing the DATABASE_URL env var. The application
# code never needs to know which database it's talking to.
# The engine and sessionmaker are cached at module level so that
# connection-pool resources (file handles, sockets) are shared across
# all requests instead of being recreated on every call.

from __future__ import annotations

from sqlalchemy import create_engine, Engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
import os

# Module-level cached engines and session makers
_engines: dict[str, Engine] = {}
_session_classes: dict[str, sessionmaker] = {}  # type: ignore[type-arg]


def get_engine(db_key: str = "olist_db") -> Engine:
    """Return the SQLAlchemy engine for the specified database, caching it."""
    global _engines
    if db_key not in _engines:
        from model.database_registry import get_database_url
        url = get_database_url(db_key)
        
        if url.startswith("sqlite"):
            # INTERN NOTE: file-based SQLite uses NullPool (one connection per
            # checkout, returned to the OS on close). check_same_thread=False
            # is required so FastAPI's async worker threads can safely reuse it.
            engine = create_engine(
                url,
                connect_args={"check_same_thread": False},
                poolclass=NullPool,
            )
        else:
            engine = create_engine(url)
        _engines[db_key] = engine
    return _engines[db_key]


def get_session(db_key: str = "olist_db") -> Session:
    """Return a new Session bound to the engine for the specified database."""
    global _session_classes
    if db_key not in _session_classes:
        _session_classes[db_key] = sessionmaker(
            autocommit=False, autoflush=False, bind=get_engine(db_key)
        )
    return _session_classes[db_key]()
