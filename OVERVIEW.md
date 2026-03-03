# Logora — App Overview

_Last updated: March 2026_

---

## What Is Logora?

Logora (branded as **Crux**) is a structured debate platform. The idea is simple: most online debates are messy thread-dumps where the same points get repeated, nothing gets resolved, and the signal drowns in noise. Logora replaces that with a **knowledge graph of arguments** — every claim is typed, every relationship is explicit, and AI continuously distills the discourse into useful summaries.

> tl;dr for non-engineers: Think Reddit threads, but every comment is tagged with what *kind* of point it is (a claim, a counter, a concession), connected visually in a graph, and summarised by AI so you can get up to speed in 30 seconds.

---

## What Can You Do in the App?

| Action | Description |
|---|---|
| **Browse debates** | Home page lists all active topics (debates) |
| **Start a debate** | Pose a canonical question, add tags, description, location |
| **Submit an argument** | Reply to the topic or to another argument node |
| **See the graph** | Switch to the graph view for a visual argument map |
| **Catch up** | Hit the ✦ catch-up button to get a 30-second AI briefing on a debate you're new to |
| **Ask a question** | Use the RAG panel to ask a free-text question and get an answer grounded in the debate |
| **Concept mode** | Toggle the "concepts" view in the graph to see only distilled epistemic claims — the knowledge mesh |
| **Mesh mode** | Connect multiple debates and see cross-topic arguments in a single graph |

---

## The Data Model (Core Concepts)

Understanding these five concepts gets you 80% of the way there.

### 1. Topic
A debate. Stored as a `canonical_question` — a single, neutrally-framed question like _"Does rent control make housing less affordable?"_ Topics have:
- **Tags**: `geographic`, `social`, `economic`, `scientific`, `political`, `environmental`
- **Status**: `active` → `cooling` (no new activity in 30 days) → `historical` (archived, read-only)
- **Discourse Tracks**: sub-threads within the debate (e.g. "Economic effects", "Policy examples")

### 2. ArgumentNode
The atomic unit. Every comment/reply is an argument node. What makes this different from a plain comment system is that every node has a **type**:

| Type | Meaning |
|---|---|
| `assertion` | Makes a positive claim (requires evidence) |
| `counter` | Directly challenges a previous argument |
| `qualification` | "True, but only under condition X" |
| `exception` | "This breaks down in case Y" |
| `synthesis` | Points of genuine agreement between positions |
| `reframe` | "The real question is actually..." |
| `open_question` | Raises something nobody has addressed |
| `concession` | Author acknowledges a valid point from the opposing side |

Nodes also carry **nuance tags** — metadata about the scope of a claim:
- `temporal` — "Was true before X, not now"
- `geographic` — "Applies to region X, not Y"
- `scale` — "True locally, reverses nationally"
- `conditional` — "Only holds if policy X is in place"
- `population_specific` — "Applies to renters, not homeowners"
- `contested_empirically` — "Experts actively disagree"

Every node has a lifecycle **state**:
`unchallenged` → `engaged` → `refined` / `branched` / `merged` / `conceded` / `dormant`

### 3. ArgumentEdge
The connection between two nodes. Each edge has a **relationship type**:
`supports`, `challenges`, `qualifies`, `refines`, `contradicts`, `synthesizes`, `questions`

These edges are what turn the comment tree into a proper argument graph.

### 4. DiscourseTrack
A named sub-thread within a topic. Tracks are either created manually by users or auto-detected by AI based on recurring themes. They act as lenses for filtering the graph.

### 5. TopicConnection
A cross-topic link. Allows two separate debates to be connected when their arguments overlap, enabling the **knowledge mesh** view — a unified graph spanning multiple debates.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│  React 18 + TypeScript + Vite                                    │
│  ReactFlow (graph), Tailwind CSS, TanStack Query                 │
└────────────────────────┬─────────────────────────────────────────┘
                         │  REST (JSON)
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  FastAPI (Python 3.11)        :8000                              │
│                                                                  │
│  Routers:                                                        │
│    /api/users        — auth (JWT), registration                  │
│    /api/topics       — CRUD topics, tracks, briefings, mesh      │
│    /api/arguments    — CRUD nodes, graph, catch-up, RAG          │
│    /api/suggestions  — AI-generated debate ideas from news       │
│    /api/news         — Curated news articles                     │
│                                                                  │
│  Services:                                                       │
│    ai_service.py    — Claude API calls (classify, summarise,    │
│                       briefing, batch-summarize, catch-up, RAG) │
│    vector_store.py  — embeddings for semantic search (RAG)      │
│    web_search_service.py — searches current news for topics     │
└────────────────────────┬─────────────────────────────────────────┘
                         │  SQLAlchemy ORM
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  SQLite (logora.db)                                              │
│  Tables: users, topics, discourse_tracks, argument_nodes,       │
│          argument_edges, topic_connections                       │
└──────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  Anthropic Claude API (claude-3-5-haiku-20241022)               │
│  Used for: classification, summarisation, briefings, RAG        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Styling | Tailwind CSS (custom design tokens) |
| Graph rendering | ReactFlow 11 + dagre (tree layout) + d3-force (rhizome layout) |
| State/fetching | TanStack Query (React Query) |
| Backend framework | FastAPI 0.115 |
| ORM | SQLAlchemy 2.0 |
| Database | SQLite (easily swappable to Postgres) |
| Auth | JWT (python-jose) + bcrypt password hashing |
| AI | Anthropic Claude via Python SDK |
| Vector search | Local embeddings (vector_store service) |

---

## AI Features

The AI is optional — every feature degrades gracefully if `ANTHROPIC_API_KEY` is not set ("stub mode").

### Node Classification
When a user submits an argument, Claude reviews the content and the parent argument to confirm (or correct) the stated type, assign nuance tags, and suggest which discourse track it belongs to.

### Concept Summarisation (`ai_summary`)
Each node has an `ai_summary` column — a distilled 18-word epistemic concept statement. Example: a 300-word argument about rent control becomes _"Price ceilings reduce housing supply by removing investor incentive to build or maintain units."_

This is generated on submission and stored permanently — it is **never re-generated on reads**, so it scales freely.

**Batch summarisation** (`POST /api/topics/{id}/arguments/batch-summarize`) processes up to 30 existing nodes per Claude call, backfilling the `ai_summary` for historically imported debates. Triggered by the "summarize" button in the topic header.

### Debate Briefing
A structured summary of the whole debate: key positions, their strength (`strong`/`moderate`/`weak`), discourse health metrics (sourced ratio, engagement ratio, echo-chamber risk), and unaddressed arguments.

### Catch-Up
For newcomers joining a debate mid-stream. Returns: established points, refuted claims, active sub-debates, and contribution opportunities ("you could challenge X" / "nobody has addressed Y").

### Debate Suggestions from News
`/api/suggestions` pulls current news articles via web search, then uses Claude to frame each one as a structured debate question suitable for the platform.

### RAG Query Panel
Users can ask a free-text question against a specific debate (e.g. "What has been said about the effect on landlords?"). The backend retrieves semantically similar argument nodes and grounds Claude's answer in them.

### Duplicate Detection
Before a node is submitted, the backend checks for semantically similar existing arguments and warns the user — keeping the graph clean.

---

## Frontend Component Map

```
App.tsx
├── pages/Home.tsx              — topic list, trending debates, debate suggestions
├── pages/Auth.tsx              — login / register (JWT stored in localStorage)
├── pages/TopicDetail.tsx       — the main debate view (two-panel layout)
│   ├── ExplorerSidebar         — tree of all argument nodes, click to highlight
│   ├── BriefingRoom            — AI briefing + discourse health metrics
│   ├── CatchUpModal            — newcomer onboarding overlay
│   ├── [comments tab]          — threaded argument tree
│   │   ├── ArgumentCard        — single argument node (with reply/delete/transition)
│   │   └── SubmitArgumentForm  — new argument form (type picker, sources, AI check)
│   ├── [graph tab]             — visual argument map
│   │   ├── ArgumentGraph       — ReactFlow graph (tree/rhizome layout, concept mode)
│   │   └── ArgumentMapExpanded — full-screen graph focus mode
│   └── RAGQueryPanel           — ask-a-question overlay
└── pages/CreateTopic.tsx       — new debate creation form
```

---

## Graph View — Three Modes

The graph is the signature feature. Accessed via the "graph" tab on any topic.

### Tree Mode (default)
Left-to-right dagre layout. Root assertions on the left, replies branching right. Nodes collapse/expand. Colour-coded by node type.

### Rhizome Mode
Force-directed (d3-force) layout. No hierarchy — nodes drift into natural clusters based on their connections. Good for seeing which arguments have many ties.

### Concept Mode (the "knowledge mesh")
Toggle with the **concepts** button in the graph toolbar. Node cards shrink and show only the AI-distilled concept statement — no author, no raw text. The graph becomes a mesh of knowledge claims rather than a thread of comments.

### Mesh Mode
Toggle at the topic header level. Loads `TopicConnection` edges and pulls argument nodes from linked debates into the same graph. Cross-topic edges are shown in amber with a dashed stroke.

---

## Running Locally

**Prerequisites:** Python 3.11+, Node.js 18+, (optional) Anthropic API key.

```bash
# 1. Clone and set up backend
cd logora/backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Copy and fill in secrets
cp .env.example .env
# Set ANTHROPIC_API_KEY, SECRET_KEY at minimum

# Start backend
python run.py        # runs on :8000

# 2. Start frontend (new terminal)
cd logora/frontend
npm install
npm run dev          # runs on :5173

# 3. (Optional) Seed with real debates from Reddit r/changemyview
cd logora/backend
python seed_from_web.py --limit 10 --no-ai
# --no-ai skips Claude calls, uses heuristics instead (free)
# --limit N imports N threads
# --timeframe week|month|year selects timeframe
# --comments-per-thread N controls depth
```

Open `http://localhost:5173`. Register an account and start debating.

---

## Environment Variables

All configured via `logora/backend/.env`:

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | No | Enables all AI features. App works without it (stub mode). |
| `SECRET_KEY` | Yes | JWT signing secret. Any random string. |
| `CLAUDE_MODEL` | No | Defaults to `claude-3-5-haiku-20241022`. |
| `DATABASE_URL` | No | Defaults to `sqlite:///./logora.db`. |
| `FRONTEND_URL` | No | Defaults to `http://localhost:5173` (CORS). |

---

## Key Files for New Engineers

| File | What it does |
|---|---|
| `backend/app/models.py` | All SQLAlchemy models and enums — start here to understand the data |
| `backend/app/routers/arguments.py` | The biggest router. Handles node CRUD, graph queries, catch-up, RAG, batch summarise |
| `backend/app/routers/topics.py` | Topic/track CRUD, briefing, mesh graph |
| `backend/app/services/ai_service.py` | All Claude calls, each with a graceful stub fallback |
| `frontend/src/types/index.ts` | TypeScript types mirroring the backend models |
| `frontend/src/api/client.ts` | All frontend API calls in one place |
| `frontend/src/components/ArgumentGraph.tsx` | The graph view (ReactFlow, dagre, d3-force, concept mode) |
| `frontend/src/pages/TopicDetail.tsx` | The main debate page — wires everything together |
| `backend/seed_from_web.py` | Reddit importer + heuristic argument classifier |

---

## Design Language

- **Brand name:** Crux
- **Primary colour:** `#3B1342` (deep plum)
- **Accent colour:** `#BF557B` (rose)
- **Typography:** Work Sans Light
- **Mark:** Diamond SVG, positioned above the wordmark
- **Tone:** Lowercase labels, minimal chrome, epistemic vocabulary ("assertion", "concession", "synthesis")

---

## Current Data

As of today the database contains:
- **48 debates** imported from Reddit r/changemyview (verified by community debate)
- **951 argument nodes** across those debates
- Source: `https://reddit.com/r/changemyview` (public JSON API, no auth required)
