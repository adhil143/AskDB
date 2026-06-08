"""
api/routes/schema.py — /api/schema endpoint.
"""

from fastapi import APIRouter, Header
from agent.semantic_layer import get_schema_for_database

router = APIRouter(prefix="/api", tags=["schema"])


@router.get("/schema")
async def get_schema(x_database: str = Header("olist_db")) -> list:
    """Return the schema for the active database as JSON."""
    return get_schema_for_database(x_database)
