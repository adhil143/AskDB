import os
import re
import logging
import shutil
from typing import Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

from model.database_registry import get_all_databases, register_database

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["databases"])


class DatabaseRegisterRequest(BaseModel):
    key: str = Field(..., min_length=1, pattern="^[a-zA-Z0-9_-]+$")
    name: str = Field(..., min_length=1)
    url: str = Field(..., min_length=1)


@router.get("/databases")
async def list_databases() -> list[dict[str, Any]]:
    """Return all registered databases."""
    try:
        return get_all_databases()
    except Exception as exc:
        logger.error("Failed to list databases: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/databases")
async def add_database(request: DatabaseRegisterRequest) -> dict[str, Any]:
    """Register a database by name and connection URL."""
    try:
        register_database(request.key, request.name, request.url)
        return {"status": "success", "message": f"Database '{request.name}' registered successfully."}
    except Exception as exc:
        logger.error("Failed to register database: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/databases/upload")
async def upload_database(
    name: str = Form(..., min_length=1),
    file: UploadFile = File(...)
) -> dict[str, Any]:
    """Upload a SQLite database file and register it."""
    # Validate file extension
    if not file.filename or not file.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="Only SQLite database files (.db) are supported.")

    try:
        # Sanitize filename
        filename = re.sub(r"[^a-zA-Z0-9._-]", "_", file.filename)
        # Unique key from name
        key = re.sub(r"[^a-zA-Z0-9_-]", "_", name.lower().strip())
        
        # Save to data directory
        dest_dir = "data"
        os.makedirs(dest_dir, exist_ok=True)
        dest_path = os.path.join(dest_dir, filename)

        logger.info("Saving uploaded database file to %s", dest_path)
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Register in databases registry
        # We store connection string relative to the project root
        connection_url = f"sqlite:///./data/{filename}"
        register_database(key, name, connection_url)

        return {
            "status": "success",
            "database": {
                "key": key,
                "name": name,
                "url": connection_url
            }
        }
    except Exception as exc:
        logger.error("Failed to upload and register database: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
