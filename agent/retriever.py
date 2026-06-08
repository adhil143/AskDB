"""
retriever.py — RAG-based schema retrieval from ChromaDB.

# INTERN NOTE: RAG retrieval explained
# At query time we embed the user's natural-language question (e.g. "top
# revenue by category") using the same model that was used during indexing.
# ChromaDB performs an approximate nearest-neighbor (ANN) cosine similarity
# search and returns the k most semantically similar table schemas.
# We then format those schemas as a compact text block and inject them into
# the LLM system prompt. This gives the LLM precise, relevant context without
# overloading the prompt with irrelevant tables.
# The quality of retrieval directly impacts SQL accuracy — better descriptions
# in the semantic layer = better retrieval = fewer hallucinated joins.
"""

import os
import logging
from typing import Optional

import chromadb
from chromadb.utils.embedding_functions import OllamaEmbeddingFunction
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

COLLECTION_NAME = "schema_index"
_client: Optional[chromadb.PersistentClient] = None
_collection: Optional[chromadb.Collection] = None


def _get_collection() -> chromadb.Collection:
    """Lazily initialise and cache the ChromaDB collection."""
    global _client, _collection
    if _collection is not None:
        return _collection

    persist_dir = os.getenv("CHROMA_PERSIST_DIR", "./chroma_store")
    embedding_model = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")

    _client = chromadb.PersistentClient(path=persist_dir)
   
    embedding_fn = OllamaEmbeddingFunction(
        url="http://localhost:11434/api/embeddings",
        model_name=embedding_model,
    )

    _collection = _client.get_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn,
    )
    return _collection


def index_database_schema(db_key: str, schema_tables: list[dict]) -> None:
    """Embed the schema tables for the database and save them in ChromaDB."""
    try:
        collection = _get_collection()
        # Delete existing entries for this database to avoid duplicates
        try:
            collection.delete(where={"database": db_key})
        except Exception:
            pass

        documents = []
        metadatas = []
        ids = []

        for table in schema_tables:
            # Serialize table
            lines = [
                f"Table: {table['table_name']}",
                f"Description: {table.get('description', '')}",
                "Columns:",
            ]
            for col in table["columns"]:
                lines.append(f"  - {col['name']}: {col.get('description', '')}")
            text = "\n".join(lines)
            
            documents.append(text)
            metadatas.append({"table_name": table["table_name"], "database": db_key})
            ids.append(f"{db_key}_{table['table_name']}")

        if documents:
            collection.add(documents=documents, metadatas=metadatas, ids=ids)
            logger.info("Indexed %d tables for database %s in ChromaDB", len(documents), db_key)
    except Exception as exc:
        logger.error("Failed to index database schema for %s: %s", db_key, exc)


def get_relevant_schema(query: str, db_key: str = "olist_db", k: int = 3) -> str:
    """
    Embed *query*, similarity-search ChromaDB, and return a formatted
    table+column block suitable for injection into an LLM prompt.

    Args:
        query:  The user's natural-language question.
        db_key: The active database identifier.
        k:      Number of most relevant tables to retrieve.

    Returns:
        A newline-delimited schema block string.
    """
    try:
        collection = _get_collection()
        
        # Self-healing index: check if schema for this database is indexed
        db_docs = collection.get(where={"database": db_key})
        if not db_docs or not db_docs.get("ids"):
            logger.info("Database '%s' schema not indexed yet. Indexing dynamically...", db_key)
            from agent.semantic_layer import get_schema_for_database
            schema_tables = get_schema_for_database(db_key)
            index_database_schema(db_key, schema_tables)
            
        # Re-check count after indexing
        db_docs = collection.get(where={"database": db_key})
        ids = db_docs.get("ids", [])
        collection_count = len(ids)
        
        if collection_count == 0:
            logger.debug("Schema collection for database '%s' is empty; returning empty context", db_key)
            return ""

        n_results = min(k, collection_count)
        if n_results < 1:
            return ""

        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where={"database": db_key}
        )
        documents: list[str] = results["documents"][0]  # type: ignore[index]
        logger.debug("Retrieved %d schema snippets for database '%s' and query: %s", len(documents), db_key, query)
        return "\n\n---\n\n".join(documents)
    except Exception as exc:
        logger.warning("Schema retrieval failed: %s — falling back to empty context.", exc)
        return ""
