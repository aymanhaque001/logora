# Architecture

> System architecture, data flow, and component relationships for Logora.

## Overview

Logora is a three-tier application: a React SPA frontend, a FastAPI backend, and two data stores (SQLite for relational data, ChromaDB for vector embeddings). All AI features are powered by Claude via the Anthropic SDK and degrade gracefully when no API key is configured.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Frontend (React SPA)                           │
│                                                                         │
│  ┌──────────┐  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Explorer  │  │   Center       │  │  Briefing    │  │  RAG Query   │  │
│  │ Sidebar   │  │  Discussion    │  │  Room        │  │  Panel       │  │
│  │ (tree     │  │  Graph View    │  │  Tracks      │  │  "Ask the    │  │
│  │  nav)     │  │  Focus Mode    │  │  Catch-Up    │  │   Debate"    │  │
│  └──────────┘  └────────────────┘  └──────────────┘  └──────────────┘  │
│                                                                         │
│  Debate Suggestions (Home) · Duplicate Check Modal · Analytics Panel    │
│                                                                         │
│  React 18 · TypeScript · TanStack Query · ReactFlow · Tailwind CSS      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │  HTTP (Vite dev proxy /api → :8000)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Backend (FastAPI)                                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Routers (REST API layer)                                       │    │
│  │  ┌──────────┐ ┌───────────┐ ┌─────────────┐ ┌──────────────┐   │    │
│  │  │ /users   │ │ /topics   │ │ /arguments  │ │ /suggestions │   │    │
│  │  │ register │ │ CRUD      │ │ CRUD        │ │ web search   │   │    │
│  │  │ login    │ │ lifecycle │ │ graph       │ │ + AI framing │   │    │
│  │  │ me       │ │ tracks    │ │ transitions │ │              │   │    │
│  │  │          │ │ briefing  │ │ dup-check   │ │              │   │    │
│  │  │          │ │ catch-up  │ │ rag-query   │ │              │   │    │
│  │  │          │ │           │ │ backfill    │ │              │   │    │
│  │  └──────────┘ └───────────┘ └─────────────┘ └──────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Services (business logic)                                      │    │
│  │  ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌──────────────┐  │    │
│  │  │ AI Service │ │ Graph RAG  │ │ Vector    │ │ Web Search   │  │    │
│  │  │ classify   │ │ retrieve   │ │ Store     │ │ DuckDuckGo   │  │    │
│  │  │ briefing   │ │ dup-check  │ │ ChromaDB  │ │ + Claude     │  │    │
│  │  │ summarize  │ │ rag-brief  │ │ embed     │ │ framing      │  │    │
│  │  │ catch-up   │ │ graph-walk │ │ search    │ │              │  │    │
│  │  │ track-det  │ │            │ │ backfill  │ │              │  │    │
│  │  └────────────┘ └────────────┘ └───────────┘ └──────────────┘  │    │
│  │  ┌────────────┐ ┌────────────┐ ┌───────────┐                   │    │
│  │  │ Auth       │ │ Credibility│ │ Config    │                   │    │
│  │  │ JWT+bcrypt │ │ scoring    │ │ .env      │                   │    │
│  │  └────────────┘ └────────────┘ └───────────┘                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  FastAPI 0.115 · SQLAlchemy 2.0 · Pydantic 2.9 · Anthropic SDK 0.34    │
└───────────┬──────────────────────────────────┬──────────────────────────┘
            │                                  │
            ▼                                  ▼
   ┌──────────────────┐              ┌───────────────────┐
   │   SQLite          │              │  ChromaDB          │
   │   logora.db       │              │  ./chroma_data/    │
   │                   │              │                    │
   │   users           │              │  Collection:       │
   │   topics          │              │  logora_arguments  │
   │   discourse_tracks│              │                    │
   │   argument_nodes  │              │  Model:            │
   │   argument_edges  │              │  all-MiniLM-L6-v2  │
   │                   │              │  384-dim, cosine   │
   └──────────────────┘              └───────────────────┘

External APIs:
   ┌──────────────────┐              ┌───────────────────┐
   │   Anthropic API   │              │  DuckDuckGo        │
   │   Claude AI       │              │  News + Text       │
   │   claude-sonnet   │              │  search (no key)   │
   └──────────────────┘              └───────────────────┘
```

---

## Data Flow

### 1. Argument Submission Flow

```
User writes argument
        │
        ▼
┌─────────────────┐
│  Frontend        │
│  SubmitArgument  │──── optional: checkDuplicate() first
│  Form            │         │
└────────┬────────┘         ▼
         │          ┌──────────────────┐
         │          │ Graph RAG        │
         │          │ check_duplicate() │
         │          │ vector search    │
         │          │ + graph walk     │
         │          │ + Claude reason  │
         │          └──────────────────┘
         │
    POST /api/topics/{id}/arguments
         │
         ▼
┌────────────────────────────────────────┐
│  arguments.py router                    │
│                                         │
│  1. Validate input (Pydantic)           │
│  2. AI classify node type + track       │  → ai_service.classify_node()
│  3. Match/create discourse track        │  → ai_service.detect_track_for_node()
│  4. Generate AI summary                 │  → ai_service.summarize_node()
│  5. Create argument_node in DB          │  → SQLAlchemy
│  6. Create argument_edge (if parent)    │
│  7. Auto-transition parent state        │  engaged / branched
│  8. Award credibility                   │  → credibility.award()
│  9. Index in vector store               │  → vector_store.add_argument()
│ 10. Return ArgumentNodeOut              │
└────────────────────────────────────────┘
```

### 2. RAG Query Flow

```
User asks "What evidence has been cited?"
        │
    POST /api/topics/{id}/arguments/rag-query
        │
        ▼
┌────────────────────────────────────────┐
│  graph_rag.rag_briefing()              │
│                                         │
│  1. Vector search (top 10 results)     │  → vector_store.search_similar()
│  2. Extract seed IDs                    │
│  3. Graph expansion (2 hops, max 30)   │  → _expand_graph() via BFS
│  4. Merge + deduplicate                 │
│  5. Build context (max 30 args × 400c) │
│  6. Claude generates balanced answer   │  → ai_service._call_claude()
│  7. Return answer + stats              │
└────────────────────────────────────────┘
```

### 3. Briefing Generation Flow

```
GET /api/topics/{id}/briefing
        │
        ▼
┌────────────────────────────────────────┐
│  topics.py router                       │
│                                         │
│  1. Load all arguments + tracks         │
│  2. Build summary dicts                 │
│  3. Call AI briefing                    │  → ai_service.generate_briefing()
│  4. Return BriefingData                 │
│     - summary                           │
│     - key_positions[]                   │
│     - track_summaries[]                 │
│     - discourse_health                  │
│     - contention_areas[]                │
└────────────────────────────────────────┘
```

### 4. Web Search Suggestions Flow

```
GET /api/suggestions?category=technology
        │
        ▼
┌────────────────────────────────────────┐
│  web_search_service                     │
│                                         │
│  1. Pick queries for category           │  3 queries per category
│  2. DuckDuckGo news search             │  max 5 results per query
│  3. Deduplicate articles                │
│  4. Claude frames as debate questions   │  → _frame_as_debates()
│     - canonical_question                │
│     - description                       │
│     - tags                              │
│     - location                          │
│     - timeliness (breaking/recent/etc)  │
│  5. Return DebateSuggestion[]           │
│                                         │
│  Fallbacks:                             │
│  - No results → hardcoded suggestions   │
│  - No Claude → stub framing             │
└────────────────────────────────────────┘
```

---

## Authentication Flow

```
POST /api/users/register → hash password (bcrypt) → store user → return JWT
POST /api/users/login    → verify password → return JWT + UserOut

All auth-required endpoints:
  Authorization: Bearer <jwt_token>
  → auth.get_current_user() dependency → decode JWT → load user from DB
```

JWT tokens are signed with `SECRET_KEY` using the `HS256` algorithm. Tokens contain the user ID in the `sub` claim. Frontend stores tokens in `localStorage` under the key `logora_token` and attaches them via an axios request interceptor.

---

## State Management

### Backend (SQLAlchemy)

- **Session-per-request**: Each API call gets a fresh `Session` via FastAPI's `Depends(get_db)` dependency.
- **Lazy loading**: Relationships are loaded on access (not eagerly).
- **Auto-commit on success**: The session is committed at the end of successful requests.

### Frontend (TanStack React Query)

- **Query keys**: Structured as `['topics']`, `['topic', id]`, `['arguments', topicId]`, `['graph', topicId]`, `['tracks', topicId]`, `['briefing', topicId]`, `['suggestions', params]`.
- **Mutations**: `useMutation` with `onSuccess` callbacks that invalidate related query keys.
- **Auth state**: Managed via `useAuth()` hook using React state + `localStorage`.
- **Stale time**: Default TanStack Query stale time (0ms) — refetches on window focus.

---

## Graceful Degradation

Logora is designed to work at multiple capability levels:

| Level         | AI  | ChromaDB | DuckDuckGo | Experience                                                                           |
| ------------- | --- | -------- | ---------- | ------------------------------------------------------------------------------------ |
| **Full**      | ✓   | ✓        | ✓          | All features: classification, briefings, RAG, duplicate detection, web suggestions   |
| **No AI**     | ✗   | ✓        | ✓          | Vector search works, stubs for classification/briefing, web search with stub framing |
| **No Vector** | ✓   | ✗        | ✓          | AI classification/briefing works, no RAG/duplicate detection, web suggestions work   |
| **Minimal**   | ✗   | ✗        | ✗          | Core debate platform: graph structure, state machine, credibility, manual tracks     |

The health endpoint (`GET /api/health`) reports the availability of each subsystem:

```json
{
  "status": "healthy",
  "version": "0.2.0",
  "ai": { "ai_enabled": true, "model": "claude-sonnet-4-6" },
  "vector_store": {
    "available": true,
    "collection_count": 75,
    "model": "all-MiniLM-L6-v2"
  },
  "web_search": { "search_available": true, "ai_framing_available": true }
}
```

---

## Directory Layout

```
backend/
├── app/
│   ├── main.py          # App factory, middleware, router mounting
│   ├── config.py        # Pydantic BaseSettings (env vars)
│   ├── database.py      # engine, SessionLocal, Base, get_db
│   ├── auth.py          # hash_password, verify_password, create_token, get_current_user
│   ├── models.py        # 5 SQLAlchemy models, 6 enums
│   ├── schemas.py       # ~20 Pydantic schemas
│   ├── routers/         # Route handlers (thin controllers)
│   └── services/        # Business logic (AI, RAG, search, credibility)
└── run.py               # uvicorn.run() entry point

frontend/
└── src/
    ├── api/client.ts    # All HTTP calls (axios)
    ├── hooks/useAuth.ts # Auth context
    ├── types/index.ts   # TypeScript interfaces
    ├── pages/           # Route-level components
    └── components/      # Reusable UI components
```

See the main [README](../README.md) for the full project structure tree.
