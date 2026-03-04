"""
Vector store service using ChromaDB + sentence-transformers.
Embeds arguments and provides similarity search for Graph RAG and duplicate detection.
"""
import sys
from typing import Optional

_chroma_client = None
_collection = None
_embedding_model = None
_init_error = None

COLLECTION_NAME = "logora_arguments"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"  # Fast, 384-dim, good for semantic search


def _get_collection():
    """Lazy-init ChromaDB collection and embedding model."""
    global _chroma_client, _collection, _embedding_model, _init_error

    if _collection is not None:
        return _collection

    try:
        import chromadb
        from chromadb.config import Settings as ChromaSettings

        _chroma_client = chromadb.Client(ChromaSettings(
            anonymized_telemetry=False,
            is_persistent=True,
            persist_directory="./chroma_data",
        ))

        _collection = _chroma_client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

        print(f"[VectorStore] ChromaDB collection '{COLLECTION_NAME}' ready. "
              f"Items: {_collection.count()}", file=sys.stderr)
        return _collection

    except Exception as e:
        _init_error = str(e)
        print(f"[VectorStore] ChromaDB init error: {e}", file=sys.stderr)
        return None


def _get_embedder():
    """Lazy-init the sentence transformer model."""
    global _embedding_model
    if _embedding_model is not None:
        return _embedding_model

    try:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        print(f"[VectorStore] Embedding model '{EMBEDDING_MODEL_NAME}' loaded.", file=sys.stderr)
        return _embedding_model
    except Exception as e:
        print(f"[VectorStore] Embedding model load error: {e}", file=sys.stderr)
        return None


def _embed(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts using the sentence transformer."""
    model = _get_embedder()
    if model is None:
        return []
    embeddings = model.encode(texts, show_progress_bar=False)
    return [emb.tolist() for emb in embeddings]


def is_available() -> bool:
    return _get_collection() is not None and _get_embedder() is not None


def add_argument(
    argument_id: str,
    content: str,
    topic_id: str,
    node_type: str,
    track_id: Optional[str] = None,
    author_id: Optional[str] = None,
    author_display_name: Optional[str] = None,
    parent_id: Optional[str] = None,
) -> bool:
    """Add or update an argument embedding in the vector store."""
    collection = _get_collection()
    if collection is None:
        return False

    embeddings = _embed([content])
    if not embeddings:
        return False

    metadata = {
        "topic_id": topic_id,
        "node_type": node_type,
        "track_id": track_id or "",
        "author_id": author_id or "",
        "author_display_name": (author_display_name or "").lower(),  # lowercase for case-insensitive matching
        "parent_id": parent_id or "",
        "content_preview": content[:200],
    }

    try:
        collection.upsert(
            ids=[argument_id],
            embeddings=embeddings,
            metadatas=[metadata],
            documents=[content],
        )
        return True
    except Exception as e:
        print(f"[VectorStore] add_argument error: {e}", file=sys.stderr)
        return False


def remove_argument(argument_id: str) -> bool:
    """Remove an argument from the vector store."""
    collection = _get_collection()
    if collection is None:
        return False
    try:
        collection.delete(ids=[argument_id])
        return True
    except Exception as e:
        print(f"[VectorStore] remove_argument error: {e}", file=sys.stderr)
        return False


def get_by_author(
    author_id: str,
    topic_id: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    """
    Retrieve all indexed arguments by a specific author_id via metadata filter.
    Does NOT use semantic search — returns everything authored by this user.
    """
    collection = _get_collection()
    if collection is None:
        return []

    where_filter: dict = {"author_id": author_id}
    if topic_id:
        where_filter = {"$and": [{"author_id": author_id}, {"topic_id": topic_id}]}

    try:
        results = collection.get(
            where=where_filter,
            include=["documents", "metadatas"],
            limit=limit,
        )
        hits = []
        for i, doc_id in enumerate(results["ids"]):
            hits.append({
                "id": doc_id,
                "content": results["documents"][i],
                "similarity": 1.0,  # exact match by author
                "metadata": results["metadatas"][i],
            })
        return hits
    except Exception as e:
        print(f"[VectorStore] get_by_author error: {e}", file=sys.stderr)
        return []


def search_similar(
    query: str,
    topic_id: Optional[str] = None,
    author_id: Optional[str] = None,
    n_results: int = 10,
    exclude_ids: Optional[list[str]] = None,
) -> list[dict]:
    """
    Find arguments semantically similar to the query.
    Optionally filter by topic_id and/or author_id.
    Returns list of {id, content, score, metadata}.
    """
    collection = _get_collection()
    if collection is None:
        return []

    embeddings = _embed([query])
    if not embeddings:
        return []

    # Build where filter — ChromaDB requires $and for multiple conditions
    if topic_id and author_id:
        where_filter = {"$and": [{"topic_id": topic_id}, {"author_id": author_id}]}
    elif topic_id:
        where_filter = {"topic_id": topic_id}
    elif author_id:
        where_filter = {"author_id": author_id}
    else:
        where_filter = None

    try:
        results = collection.query(
            query_embeddings=embeddings,
            n_results=min(n_results + len(exclude_ids or []), 50),
            where=where_filter,
            include=["documents", "metadatas", "distances"],
        )

        hits = []
        for i, doc_id in enumerate(results["ids"][0]):
            if exclude_ids and doc_id in exclude_ids:
                continue
            distance = results["distances"][0][i]
            similarity = 1.0 - distance  # cosine distance → similarity
            hits.append({
                "id": doc_id,
                "content": results["documents"][0][i],
                "similarity": round(similarity, 4),
                "metadata": results["metadatas"][0][i],
            })
            if len(hits) >= n_results:
                break

        return hits
    except Exception as e:
        print(f"[VectorStore] search_similar error: {e}", file=sys.stderr)
        return []


def backfill_from_db(db_session) -> int:
    """
    Backfill all existing arguments into the vector store.
    Returns count of arguments indexed.
    """
    from app.models import ArgumentNode
    from sqlalchemy.orm import joinedload

    collection = _get_collection()
    if collection is None:
        return 0

    arguments = db_session.query(ArgumentNode).options(joinedload(ArgumentNode.author)).all()
    if not arguments:
        return 0

    count = 0
    # Process in batches of 32
    batch_size = 32
    for i in range(0, len(arguments), batch_size):
        batch = arguments[i:i + batch_size]
        texts = [a.content for a in batch]
        embeddings = _embed(texts)
        if not embeddings:
            continue

        ids = [a.id for a in batch]
        metadatas = [
            {
                "topic_id": a.topic_id,
                "node_type": a.node_type.value if hasattr(a.node_type, 'value') else a.node_type,
                "track_id": a.track_id or "",
                "author_id": a.author_id or "",
                "author_display_name": (a.author.display_name if a.author else "").lower(),
                "parent_id": a.parent_id or "",
                "content_preview": a.content[:200],
            }
            for a in batch
        ]
        documents = texts

        try:
            collection.upsert(
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas,
                documents=documents,
            )
            count += len(batch)
        except Exception as e:
            print(f"[VectorStore] backfill batch error: {e}", file=sys.stderr)

    print(f"[VectorStore] Backfilled {count}/{len(arguments)} arguments.", file=sys.stderr)
    return count


def get_status() -> dict:
    collection = _get_collection()
    return {
        "available": is_available(),
        "collection_count": collection.count() if collection else 0,
        "model": EMBEDDING_MODEL_NAME,
        "init_error": _init_error,
    }
