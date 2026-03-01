# Graph RAG

> Technical documentation for Logora's hybrid Graph RAG pipeline: vector store, graph traversal, duplicate detection, and retrieval-augmented generation.

---

## Overview

Logora's RAG system is a **hybrid retrieval pipeline** that combines two complementary search strategies:

1. **Vector similarity search** (ChromaDB) — finds semantically similar arguments by embedding content
2. **Graph expansion** (BFS on argument graph) — discovers structurally related arguments by traversing parent/child/edge relationships

The merged results are deduplicated and fed to Claude for analysis, enabling three features:

- **Duplicate Detection** — prevents rehashed arguments before submission
- **RAG Q&A ("Ask the Debate")** — answers analytical questions about any debate
- **Contextual Enrichment** — provides richer context for AI operations

---

## Architecture

```
User Query / Content
        │
        ▼
┌────────────────────────┐
│   Vector Search         │
│   ChromaDB              │
│   all-MiniLM-L6-v2     │
│   cosine similarity    │
│   → top-N results      │
└───────────┬────────────┘
            │
            │  seed IDs
            ▼
┌────────────────────────┐
│   Graph Expansion       │
│   BFS from seed nodes   │
│   parent_id chains      │
│   children              │
│   argument_edges        │
│   → structurally        │
│     related nodes       │
└───────────┬────────────┘
            │
            │  merge + deduplicate
            ▼
┌────────────────────────┐
│   Claude Analysis       │
│   Balanced reasoning    │
│   Citation-backed       │
│   Structured response   │
└────────────────────────┘
```

---

## Vector Store (ChromaDB)

**Source:** `backend/app/services/vector_store.py`

### Configuration

| Setting              | Value              |
| -------------------- | ------------------ |
| Collection name      | `logora_arguments` |
| Embedding model      | `all-MiniLM-L6-v2` |
| Embedding dimensions | 384                |
| Distance metric      | Cosine             |
| Persist directory    | `./chroma_data/`   |
| Backfill batch size  | 32                 |

### Metadata Fields

Each argument is stored in ChromaDB with these metadata fields for filtering:

| Field             | Type   | Description                      |
| ----------------- | ------ | -------------------------------- |
| `topic_id`        | string | Parent topic ID (primary filter) |
| `node_type`       | string | Argument node type               |
| `track_id`        | string | Discourse track ID (or `"none"`) |
| `author_id`       | string | Author user ID                   |
| `parent_id`       | string | Parent argument ID (or `"none"`) |
| `content_preview` | string | First 200 characters of content  |

### Functions

#### `add_argument(argument_id, content, topic_id, node_type, track_id, author_id, parent_id)`

Upserts a single argument into the vector store. Called automatically on argument submission.

- Embeds the content using `all-MiniLM-L6-v2`
- Stores embedding + metadata in ChromaDB
- Idempotent (upsert — safe to call multiple times)

#### `remove_argument(argument_id)`

Deletes an argument from the vector store. Called on argument deletion.

#### `search_similar(query, topic_id, n_results=10, exclude_ids=None)`

Cosine similarity search within a topic.

- Embeds the query text
- Filters by `topic_id` metadata
- Excludes specified IDs (e.g., the argument being checked for duplicates)
- Retrieves up to `min(n_results, 50)` candidates
- Returns results sorted by similarity (highest first)

**Return format:**

```python
[
    {
        "id": "argument-uuid",
        "content": "Full argument text...",
        "similarity": 0.87,
        "metadata": {
            "topic_id": "...",
            "node_type": "assertion",
            "track_id": "...",
            "author_id": "...",
            "parent_id": "...",
            "content_preview": "First 200 chars..."
        }
    }
]
```

#### `backfill_from_db(db_session)`

Batch-indexes all existing arguments from SQLite into ChromaDB.

- Processes in batches of 32
- Uses bulk embedding for efficiency
- Idempotent (upserts)
- Logs progress to console

#### `is_available()`

Returns `True` if both ChromaDB collection and SentenceTransformer model are initialized.

#### `get_status()`

Returns diagnostic info:

```python
{
    "available": True,
    "collection_count": 75,
    "model": "all-MiniLM-L6-v2",
    "init_error": None
}
```

---

## Graph Expansion

**Source:** `backend/app/services/graph_rag.py`

### `_expand_graph(seed_ids, db, max_hops=2, max_nodes=30)`

BFS graph walk starting from seed argument IDs. Discovers structurally related arguments by following:

1. **Parent chains** — `parent_id` references (upward)
2. **Children** — arguments where `parent_id = current node` (downward)
3. **Argument edges** — `argument_edges` table, both directions (source → target and target → source)

**Parameters:**

| Param       | Default | Description                        |
| ----------- | ------- | ---------------------------------- |
| `seed_ids`  | —       | List of argument IDs to start from |
| `max_hops`  | 2       | Maximum BFS depth                  |
| `max_nodes` | 30      | Maximum total nodes to return      |

**Returns:** List of dictionaries with argument data and hop distance:

```python
[
    {
        "id": "arg-uuid",
        "content": "Full text...",
        "node_type": "counter",
        "state": "engaged",
        "author_name": "Sarah Chen",
        "track_name": "Economic Effects",
        "parent_id": "parent-uuid",
        "children_count": 2,
        "hop": 1  # distance from nearest seed node
    }
]
```

**Behavior:**

- BFS ensures nearest nodes are found first
- Stops when `max_nodes` is reached or all reachable nodes within `max_hops` are visited
- Deduplicates internally (each node appears once, at its minimum hop distance)
- Loads author and track names via SQLAlchemy joins

---

## Retrieval Pipeline

### `retrieve_context(query, topic_id, db, n_vector_results=8, max_graph_hops=2, max_total_nodes=25)`

The core retrieval function that combines vector search and graph expansion.

**Pipeline:**

```
1. Vector Search
   ┌────────────────────────────────────────┐
   │ search_similar(query, topic_id,        │
   │                n_results=8)            │
   │ → [{id, content, similarity, meta}]    │
   └────────────────────┬───────────────────┘
                        │
2. Extract Seed IDs     │
   seed_ids = [r.id for r in vector_results]
                        │
3. Graph Expansion      │
   ┌────────────────────▼───────────────────┐
   │ _expand_graph(seed_ids, db,            │
   │               max_hops=2,              │
   │               max_nodes=25)            │
   │ → [{id, content, node_type, hop, ...}] │
   └────────────────────┬───────────────────┘
                        │
4. Merge & Deduplicate  │
   ┌────────────────────▼───────────────────┐
   │ Vector results contribute:             │
   │   {id, content, similarity, source}    │
   │ Graph results contribute:              │
   │   {id, content, hop, source}           │
   │ Dedup by ID, vector results take       │
   │ priority (have similarity score)       │
   └────────────────────┬───────────────────┘
                        │
5. Return               │
   {vector_hits, graph_expanded,
    merged_context, stats}
```

**Return format:**

```python
{
    "vector_hits": [...],       # Raw vector search results
    "graph_expanded": [...],    # Raw graph expansion results
    "merged_context": [...],    # Deduplicated merged results
    "stats": {
        "vector_count": 8,
        "graph_count": 15,
        "merged_count": 12,
        "unique_from_graph": 4  # Nodes found only via graph
    }
}
```

---

## Duplicate Detection

### `check_duplicate(content, topic_id, db, similarity_threshold=0.75)`

Checks whether proposed argument content duplicates an existing argument.

**Pipeline:**

```
1. Vector Search (narrow)
   search_similar(content, topic_id, n_results=5)
        │
2. Check threshold
   Any result with similarity ≥ 0.75?
        │
   ┌────┴────┐
   No        Yes
   │         │
   │    3. Graph Expand (1 hop, 15 nodes)
   │         │
   │    4. Build context string
   │         │
   │    5. Claude Analysis
   │         │ "Is this a duplicate? How to differentiate?"
   │         │
   │         ▼
   │    Return {is_duplicate, confidence,
   │            similar_arguments, explanation,
   │            suggestion}
   │
   Return {is_duplicate: false, confidence: 0,
           similar_arguments: [...]}
```

**Parameters:**

| Param                  | Default | Description                               |
| ---------------------- | ------- | ----------------------------------------- |
| `content`              | —       | Proposed argument text                    |
| `topic_id`             | —       | Topic to check within                     |
| `similarity_threshold` | 0.75    | Minimum similarity to trigger analysis    |
| `n_vector_results`     | 5       | Number of vector search results           |
| `max_graph_hops`       | 1       | Graph expansion depth (shallow for speed) |
| `max_total_nodes`      | 15      | Max nodes in graph expansion              |

**Claude Prompt:**
Claude receives the proposed content and similar existing arguments, and is asked to:

1. Determine if this is a genuine duplicate or rehash
2. Rate confidence (0-1)
3. Explain what overlaps
4. Suggest how the user could differentiate their contribution

**Stub Fallback (no AI):**
When Claude is unavailable, uses a simple threshold:

- Similarity > **0.85** → marked as duplicate with high confidence
- Similarity ≤ 0.85 → marked as original

---

## RAG Q&A

### `rag_briefing(topic_question, query, topic_id, db)`

Answers analytical questions about a debate using the full hybrid retrieval pipeline.

**Parameters:**

| Param              | Value | Description            |
| ------------------ | ----- | ---------------------- |
| `n_vector_results` | 10    | Broader search for Q&A |
| `max_graph_hops`   | 2     | Full 2-hop expansion   |
| `max_total_nodes`  | 30    | Generous node budget   |

**Pipeline:**

```
1. retrieve_context(query, topic_id, db,
                    n_results=10, hops=2, nodes=30)
        │
2. Build context string
   For each argument in merged_context (max 30):
     "- [{node_type}] {content[:400]} (by {author})"
        │
3. Claude System Prompt:
   "You are a neutral debate analyst for the topic: ..."
   "Based on these arguments, answer the user's question."
   "Cite specific arguments. Note what's missing."
        │
4. Return {answer, context_used, retrieval_stats, ai_powered}
```

**Suggested Queries (shown in UI):**

1. "What are the main points of agreement?"
2. "What evidence has been cited?"
3. "What arguments remain unchallenged?"
4. "Where do the key disagreements lie?"
5. "What has been conceded so far?"

---

## Parameters Reference

Summary of all configurable thresholds across the RAG system:

### Vector Store

| Parameter       | Value            | Location        |
| --------------- | ---------------- | --------------- |
| Embedding model | all-MiniLM-L6-v2 | vector_store.py |
| Dimensions      | 384              | vector_store.py |
| Distance metric | cosine           | vector_store.py |
| Batch size      | 32               | vector_store.py |
| Max candidates  | 50               | vector_store.py |

### Duplicate Detection

| Parameter                | Value | Location     |
| ------------------------ | ----- | ------------ |
| Similarity threshold     | 0.75  | graph_rag.py |
| Vector results           | 5     | graph_rag.py |
| Graph hops               | 1     | graph_rag.py |
| Max graph nodes          | 15    | graph_rag.py |
| Stub duplicate threshold | 0.85  | graph_rag.py |

### RAG Q&A

| Parameter          | Value     | Location     |
| ------------------ | --------- | ------------ |
| Vector results     | 10        | graph_rag.py |
| Graph hops         | 2         | graph_rag.py |
| Max graph nodes    | 30        | graph_rag.py |
| Content truncation | 400 chars | graph_rag.py |
| Max context items  | 30        | graph_rag.py |

### General Retrieval

| Parameter       | Value | Location     |
| --------------- | ----- | ------------ |
| Vector results  | 8     | graph_rag.py |
| Graph hops      | 2     | graph_rag.py |
| Max graph nodes | 25    | graph_rag.py |

---

## Backfilling

When the vector store is empty (e.g., after seeding data or resetting ChromaDB), arguments can be backfilled:

### Via API

```bash
curl -X POST http://localhost:8000/api/topics/{topic_id}/arguments/backfill-vectors
```

### Programmatically

```python
from app.services.vector_store import backfill_from_db
from app.database import SessionLocal

db = SessionLocal()
backfill_from_db(db)
db.close()
```

### Automatic Indexing

New arguments are automatically indexed in the vector store on submission (in the `POST /arguments` endpoint). No manual backfill is needed for ongoing use — only for pre-existing data.

---

## Graceful Degradation

| Scenario             | Behavior                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| ChromaDB unavailable | `search_similar` returns `[]`, duplicate check returns `{is_duplicate: false}`, RAG query returns `{answer: "Vector store unavailable"}` |
| Claude unavailable   | Stub duplicate check uses similarity > 0.85 threshold; RAG returns context summary without AI analysis                                   |
| Both unavailable     | Core debate features still work (arguments, graph, state machine, credibility)                                                           |

The health endpoint reports availability:

```
GET /api/health → { vector_store: { available: true/false }, ai: { ai_enabled: true/false } }
```
