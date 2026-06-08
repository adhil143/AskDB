import json
import os
import logging
from typing import Any

logger = logging.getLogger(__name__)

REGISTRY_PATH = os.path.join("data", "databases.json")

def load_registry() -> dict[str, Any]:
    """Load the database registry configuration from data/databases.json."""
    if not os.path.exists(REGISTRY_PATH):
        os.makedirs(os.path.dirname(REGISTRY_PATH), exist_ok=True)
        default_registry = {
            "olist_db": {
                "key": "olist_db",
                "name": "Olist E-commerce",
                "url": os.getenv("DATABASE_URL", "sqlite:///./data/olist.db")
            }
        }
        try:
            with open(REGISTRY_PATH, "w") as fh:
                json.dump(default_registry, fh, indent=2)
            logger.info("Initialized default database registry at %s", REGISTRY_PATH)
        except Exception as exc:
            logger.error("Failed to write default registry: %s", exc)
        return default_registry

    try:
        with open(REGISTRY_PATH, "r") as fh:
            return json.load(fh)
    except Exception as exc:
        logger.error("Failed to read database registry: %s. Returning empty.", exc)
        return {}

def save_registry(registry: dict[str, Any]) -> None:
    """Save the database registry configuration to data/databases.json."""
    try:
        os.makedirs(os.path.dirname(REGISTRY_PATH), exist_ok=True)
        with open(REGISTRY_PATH, "w") as fh:
            json.dump(registry, fh, indent=2)
        logger.info("Saved database registry to %s", REGISTRY_PATH)
    except Exception as exc:
        logger.error("Failed to save registry: %s", exc)

def register_database(key: str, name: str, url: str) -> None:
    """Register a new database configuration."""
    registry = load_registry()
    registry[key] = {
        "key": key,
        "name": name,
        "url": url
    }
    save_registry(registry)

def get_database_url(key: str) -> str:
    """Get the connection URL for the specified database key. Fallback to olist_db if missing."""
    registry = load_registry()
    db_config = registry.get(key)
    if not db_config:
        logger.warning("Database key '%s' not found in registry. Falling back to olist_db.", key)
        return registry.get("olist_db", {}).get("url", "sqlite:///./data/olist.db")
    return db_config["url"]

def get_all_databases() -> list[dict[str, Any]]:
    """Return all registered databases as a list of configurations."""
    registry = load_registry()
    return list(registry.values())
