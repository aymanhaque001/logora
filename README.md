<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Claude_AI-191919?style=for-the-badge&logo=anthropic&logoColor=white" />
  <img src="https://img.shields.io/badge/ChromaDB-FF6F00?style=for-the-badge&logo=databricks&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
</p>

# Logora

**A structured debate platform and knowledge base — so people don't argue in circles.**

Logora models debates as directed graphs of typed arguments, not flat comment threads. Arguments branch, synthesize, get challenged, and reach resolution. AI classifies contributions, detects patterns, and generates neutral briefings. A hybrid Graph RAG system provides semantic search across arguments, detects duplicate/rehashed points, and answers analytical questions about any debate. The result is a living repository where newcomers can see what's been established, what's contested, and where they can most usefully contribute.

---

## Table of Contents

- [Why Logora?](#why-logora)
- [Core Concepts](#core-concepts)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [Seed Data](#seed-data)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [License](#license)

---

## Why Logora?

Online debates suffer from three problems:

1. **Circular arguments** — people rehash the same points endlessly
2. **Lost context** — newcomers have no idea what's already been said
3. **Flat structure** — comment threads don't capture the actual logical structure of a debate

Logora solves these by treating debates as **knowledge graphs** instead of comment threads. Every argument is a typed node (assertion, counter, qualification, synthesis, etc.) connected by typed edges (supports, challenges, qualifies, refines). AI classifies contributions, generates neutral summaries, and identifies gaps. A **Graph RAG** pipeline backed by ChromaDB merges vector similarity with graph traversal to catch duplicates before they're posted and answer complex queries about the state of any debate. The debate becomes a persistent, structured knowledge base that grows more useful over time.

---

## Core Concepts

### Argument Graph

Debates are modeled as **directed acyclic graphs** of argument nodes, not flat threads. Each node has a semantic type:

| Node Type         | Description                                             |
| ----------------- | ------------------------------------------------------- |
| **Assertion**     | A claim or position statement                           |
| **Counter**       | Directly challenges another argument                    |
| **Qualification** | Adds nuance or conditions to an argument                |
| **Exception**     | Identifies edge cases where an argument doesn't hold    |
| **Synthesis**     | Combines multiple arguments into a higher-level insight |
| **Reframe**       | Recontextualizes the debate from a different angle      |
| **Open Question** | Raises an unanswered question for the community         |
| **Concession**    | Acknowledges validity of an opposing point              |

Edges between arguments carry relationship types: `supports`, `challenges`, `qualifies`, `refines`, `contradicts`, `synthesizes`, `questions`.

### Argument State Machine

Arguments progress through a lifecycle:

```
unchallenged ──→ engaged ──→ refined ──→ engaged (cycle)
                    │              │
                    ├──→ branched ──→ merged (terminal)
                    │
                    └──→ conceded (terminal)

Any state ──→ dormant (30 days inactive) ──→ engaged (re-engaged)
```

- **Unchallenged** → **Engaged**: Automatically when the first response is submitted
- **Engaged** → **Branched**: Automatically when 3+ children from 2+ distinct authors
- **Engaged** → **Refined**: When the author edits their argument after receiving responses
- **Conceded**: Author acknowledges their point was wrong (awards credibility)
- **Dormant**: No activity for 30 days (can be re-engaged)

### Discourse Tracks

Debates naturally fragment into sub-themes. Logora organizes these into **discourse tracks** — either manually created or **auto-detected by AI**. When you submit an argument, Claude analyzes it and assigns it to an existing track or creates a new one if it introduces a novel theme.

### Credibility System

Users earn credibility based on contribution quality, not volume:

| Action                                 | Points |
| -------------------------------------- | :----: |
| Submit argument with sources           |  +2.0  |
| Submit argument without sources        |  +0.5  |
| Your argument receives engagement      |  +1.0  |
| Concede a point (intellectual honesty) |  +3.0  |
| Someone concedes to your argument      |  +2.0  |

Credibility is displayed next to every user's name, creating a soft incentive for sourced, honest participation. Score is clamped to [0, 100].

### AI Briefing Room

Claude generates a neutral analysis of each debate:

- **Summary** — what the debate is about and where it stands
- **Key positions** — the strongest arguments on each side, with strength ratings
- **Discourse health** — engagement quality, nuance level, echo chamber risk
- **Unaddressed gaps** — points that no one has responded to yet
- **Track summaries** — what's happening in each sub-theme

This runs without AI too — the system falls back to computed statistics when no API key is set.

### Graph RAG

Logora uses a **hybrid retrieval-augmented generation** pipeline that combines vector similarity search with graph traversal:

1. **Vector Search** — ChromaDB indexes all arguments with `all-MiniLM-L6-v2` embeddings (384-dim). Cosine similarity finds semantically related arguments.
2. **Graph Expansion** — Starting from vector hits, BFS walks the argument graph (parent chains, children, edges) up to 2 hops, surfacing structurally related context.
3. **Deduplication & Merge** — Vector and graph results are merged, deduplicated, and sorted by relevance.
4. **Claude Analysis** — The merged context is sent to Claude for balanced, citation-backed answers.

This powers three features:

- **Duplicate Detection** — before submission, checks if an argument rehashes an existing point (threshold: 0.75 similarity)
- **RAG Q&A ("Ask the Debate")** — answer analytical questions about any debate using full argument context
- **Catch-Up Briefings** — AI-generated summaries personalized to a newcomer's expertise

> See [docs/graph-rag.md](docs/graph-rag.md) for the full technical breakdown.

---

## Features

### Debate Structure

- **Graph-based debate structure** — arguments as typed nodes with typed edges, not flat comments
- **State machine** — arguments progress through lifecycle states with auto and manual transitions
- **Discourse tracks** — auto-detected sub-themes that organize complex debates
- **Credibility scoring** — rewards sourced arguments and intellectual honesty
- **Nuance tags** — temporal, geographic, scale, conditional, population-specific, contested empirically
- **Source citations** — attach URLs with titles and descriptions to arguments
- **Topic lifecycle** — active → cooling (30 days no activity) → historical (archived)
- **Tag filtering** — geographic, social, economic, scientific, political, environmental

### AI-Powered Intelligence

- **AI classification** — Claude auto-classifies argument type, assigns tracks, generates summaries
- **AI briefings** — neutral debate analysis with health metrics and gap detection
- **Duplicate / rehash detection** — Graph RAG checks if your argument already exists before submission
- **Newcomer catch-up** — personalized briefing of established points, active debates, and contribution opportunities
- **RAG Q&A** — ask analytical questions about any debate and get citation-backed answers
- **Web search suggestions** — DuckDuckGo searches recent news, Claude frames results as debate topics

### Visualization & Analytics

- **Interactive argument map** — ReactFlow-powered graph with dagre layout
- **Expandable focus mode** — fullscreen map with 4 layout modes (top-down, left-right, radial, cluster-by-track)
- **4 color overlays** — node type, argument state, age gradient, connectivity intensity
- **Debate analytics panel** — type/state/edge distributions, discourse health ratio, depth analysis, most-connected nodes
- **VSCode-style explorer sidebar** — collapsible tree hierarchy with AI summaries

### Interface

- **Comment-style feed** — threaded, scrollable argument cards with inline reply forms
- **Dark theme** — full dark mode UI with indigo accents
- **JWT authentication** — secure token-based auth with bcrypt password hashing

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Frontend (React)                               │
│                                                                         │
│  ┌──────────┐  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Explorer  │  │  Comment Feed  │  │  Briefing    │  │  RAG Query   │  │
│  │ Sidebar   │  │  + Graph View  │  │  Room        │  │  Panel       │  │
│  │ (tree)    │  │  + Focus Mode  │  │  + Tracks    │  │  "Ask the    │  │
│  │           │  │  + Analytics   │  │  + Catch-Up  │  │   Debate"    │  │
│  └──────────┘  └────────────────┘  └──────────────┘  └──────────────┘  │
│                                                                         │
│  React 18 · TypeScript · TanStack Query · ReactFlow · Tailwind          │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ /api (Vite proxy)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Backend (FastAPI)                                  │
│                                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Auth     │  │  REST API     │  │  AI Service   │  │  Graph RAG     │  │
│  │ (JWT +   │  │  /users       │  │  Claude       │  │  Vector search │  │
│  │  bcrypt) │  │  /topics      │  │  classify     │  │  Graph walk    │  │
│  │          │  │  /arguments   │  │  briefings    │  │  Duplicate     │  │
│  │          │  │  /suggestions │  │  catch-up     │  │  RAG Q&A       │  │
│  └──────────┘  └──────────────┘  └──────────────┘  └────────────────┘  │
│                                                                         │
│  ┌───────────────────────────┐  ┌──────────────────────────────────┐    │
│  │  Web Search Service       │  │  Credibility Scoring             │    │
│  │  DuckDuckGo + Claude      │  │  Quality-based point system      │    │
│  │  framing                  │  │                                  │    │
│  └───────────────────────────┘  └──────────────────────────────────┘    │
│                                                                         │
│  FastAPI · SQLAlchemy · Pydantic · Anthropic SDK                         │
└───────────┬──────────────────────────────────┬──────────────────────────┘
            │                                  │
            ▼                                  ▼
   ┌──────────────────┐              ┌───────────────────┐
   │   SQLite (local) │              │  ChromaDB (local)  │
   │   logora.db      │              │  ./chroma_data/    │
   │   relational     │              │  384-dim vectors   │
   │   data           │              │  cosine distance   │
   └──────────────────┘              └───────────────────┘
```

---

## Tech Stack

### Backend

| Package                                                          | Version | Purpose                                 |
| ---------------------------------------------------------------- | ------- | --------------------------------------- |
| [FastAPI](https://fastapi.tiangolo.com/)                         | 0.115   | Async Python web framework              |
| [SQLAlchemy](https://www.sqlalchemy.org/)                        | 2.0     | ORM with SQLite                         |
| [Pydantic](https://docs.pydantic.dev/)                           | 2.9     | Data validation and serialization       |
| [Anthropic SDK](https://docs.anthropic.com/)                     | 0.34    | Claude AI integration                   |
| [ChromaDB](https://www.trychroma.com/)                           | ≥1.0    | Vector database for semantic search     |
| [sentence-transformers](https://www.sbert.net/)                  | ≥3.0    | `all-MiniLM-L6-v2` embeddings (384-dim) |
| [duckduckgo-search](https://github.com/deedy5/duckduckgo_search) | ≥8.0    | Web search for debate suggestions       |
| [python-jose](https://python-jose.readthedocs.io/)               | —       | JWT token handling                      |
| [bcrypt](https://github.com/pyca/bcrypt)                         | 4.2     | Password hashing                        |
| [Uvicorn](https://www.uvicorn.org/)                              | 0.30    | ASGI server                             |

### Frontend

| Package                                            | Version | Purpose                         |
| -------------------------------------------------- | ------- | ------------------------------- |
| [React](https://react.dev/)                        | 18.3    | UI framework                    |
| [TypeScript](https://www.typescriptlang.org/)      | 5.5     | Type safety                     |
| [Vite](https://vitejs.dev/)                        | 5.4     | Build tool and dev server       |
| [TanStack React Query](https://tanstack.com/query) | 5       | Data fetching & caching         |
| [React Router](https://reactrouter.com/)           | 6       | Client-side routing             |
| [ReactFlow](https://reactflow.dev/)                | 11      | Interactive graph visualization |
| [Tailwind CSS](https://tailwindcss.com/)           | 3.4     | Utility-first styling           |
| [dagre](https://github.com/dagrejs/dagre)          | 0.8     | Automatic graph layout          |
| [lucide-react](https://lucide.dev/)                | —       | Icons                           |
| [date-fns](https://date-fns.org/)                  | —       | Date formatting                 |
| [axios](https://axios-http.com/)                   | —       | HTTP client                     |

---

## Installation

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**
- **Anthropic API key** (optional — app works without it using stub responses)

### Clone the Repository

```bash
git clone https://github.com/aymanhaque001/logora.git
cd logora
```

### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env
```

Edit `backend/.env` with your values:

```env
DATABASE_URL=sqlite:///./logora.db
SECRET_KEY=your-secret-key-here          # any random string for JWT signing
ANTHROPIC_API_KEY=sk-ant-...             # optional — leave empty for stub mode
CLAUDE_MODEL=claude-sonnet-4-6
FRONTEND_URL=http://localhost:5173
```

> **Note:** The app works fully without an Anthropic API key. AI features (classification, briefings, summaries, track detection, duplicate detection, RAG Q&A, catch-up, web search framing) will return sensible stub/computed responses instead.

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

No additional configuration is needed — Vite is pre-configured to proxy `/api` requests to the backend at `localhost:8000`.

---

## Running the App

### Option 1: Start Script (recommended)

From the project root:

```bash
chmod +x start.sh
./start.sh
```

This starts both the backend and frontend in the background, with signal handling for clean shutdown via `Ctrl+C`.

### Option 2: Manual Start

**Terminal 1 — Backend:**

```bash
cd backend
source venv/bin/activate
python run.py
```

Backend starts at `http://localhost:8000`. API docs available at `http://localhost:8000/docs`.

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

Frontend starts at `http://localhost:5173`.

### Verify It's Working

- Open `http://localhost:5173` — you should see the Logora login page
- Open `http://localhost:8000/docs` — interactive Swagger API docs
- Hit `http://localhost:8000/api/health` — should show status of AI, vector store, and web search

---

## Seed Data

Load demo data with realistic arguments, sources, and users:

```bash
cd backend
source venv/bin/activate
python seed_expanded.py
```

This creates:

**12 Users** (all with password `password123`):

| Email              | Name             | Expert Domain           | Credibility |
| ------------------ | ---------------- | ----------------------- | :---------: |
| sarah@example.com  | Sarah Chen       | Urban Economics         |     82      |
| marcus@example.com | Marcus Osei      | Urban Planning          |     79      |
| priya@example.com  | Priya Sharma     | —                       |     65      |
| david@example.com  | David Kowalski   | —                       |     58      |
| elena@example.com  | Elena Vasquez    | Sociology               |     77      |
| james@example.com  | James Liu        | International Relations |     84      |
| fatima@example.com | Fatima Al-Rashid | Middle East Studies     |     80      |
| thomas@example.com | Thomas Berg      | Computer Science        |     76      |
| anika@example.com  | Anika Patel      | —                       |     62      |
| carlos@example.com | Carlos Mendez    | Political Economy       |     73      |
| yuki@example.com   | Yuki Tanaka      | Environmental Science   |     78      |
| olivia@example.com | Olivia Wright    | —                       |     55      |

**10 Debate Topics** with 30 discourse tracks and 75+ arguments:

| #   | Topic                                                                                  | Tags                              |
| --- | -------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | Is gentrification net harmful to low-income urban residents in major US cities?        | geographic, social, economic      |
| 2   | Does increased low-skilled immigration depress wages for native low-income workers?    | economic, social, political       |
| 3   | Should cities prioritise cycling infrastructure over car lanes in dense urban centres? | geographic, social, environmental |
| 4   | Should governments regulate frontier AI models before deployment?                      | scientific, political, economic   |
| 5   | Is a Chinese military invasion of Taiwan likely within the next decade?                | political, economic, geographic   |
| 6   | Should the West push for a negotiated settlement in Ukraine?                           | political, geographic, social     |
| 7   | Is Universal Basic Income a viable replacement for existing welfare programs?          | economic, social, political       |
| 8   | Is a two-state solution still viable for the Israeli-Palestinian conflict?             | political, geographic, social     |
| 9   | Is social media fundamentally incompatible with healthy democratic discourse?          | social, political, scientific     |
| 10  | Can BRICS nations realistically challenge US dollar hegemony?                          | economic, political, geographic   |

All arguments include real academic citations and demonstrate the full range of node types and states.

### Backfill Vector Store

After seeding, index all arguments in ChromaDB for RAG features:

```bash
curl -X POST http://localhost:8000/api/topics/{topic_id}/arguments/backfill-vectors
```

Or trigger from code — the vector store automatically indexes new arguments on submission.

---

## Project Structure

```
logora/
├── start.sh                         # Start both servers
├── .gitignore
│
├── backend/
│   ├── run.py                       # Uvicorn entry point
│   ├── seed.py                      # Basic demo data seeder (5 users, 3 topics)
│   ├── seed_expanded.py             # Full demo data seeder (12 users, 10 topics, 75+ args)
│   ├── requirements.txt
│   ├── .env                         # Environment variables (not in git)
│   ├── .env.example                 # Template for .env
│   │
│   └── app/
│       ├── main.py                  # FastAPI app, CORS, router mounting, health
│       ├── config.py                # Pydantic settings (reads .env)
│       ├── database.py              # SQLAlchemy engine + session
│       ├── auth.py                  # JWT + bcrypt auth utilities
│       ├── models.py                # SQLAlchemy models (5 tables, 6 enums)
│       ├── schemas.py               # Pydantic request/response schemas
│       │
│       ├── routers/
│       │   ├── users.py             # /api/users — register, login, profile
│       │   ├── topics.py            # /api/topics — CRUD, lifecycle, tracks, briefing, catch-up
│       │   ├── arguments.py         # /api/topics/{id}/arguments — CRUD, graph, transitions,
│       │   │                        #   duplicate check, RAG query, vector backfill
│       │   └── suggestions.py       # /api/suggestions — web search debate suggestions
│       │
│       └── services/
│           ├── ai_service.py        # Claude AI (classify, brief, summarize, catch-up)
│           ├── credibility.py       # Credibility scoring system
│           ├── vector_store.py      # ChromaDB vector store (embed, search, backfill)
│           ├── graph_rag.py         # Hybrid RAG (vector + graph walk + Claude analysis)
│           └── web_search_service.py # DuckDuckGo + Claude debate suggestion framing
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts               # Vite config (proxy /api → :8000)
│   ├── tailwind.config.js           # Dark theme tokens + animations
│   ├── tsconfig.json
│   ├── index.html
│   │
│   └── src/
│       ├── main.tsx                 # React entry point
│       ├── App.tsx                  # Auth gate, routing, navbar
│       ├── index.css                # Global styles + Tailwind
│       │
│       ├── api/
│       │   └── client.ts            # Axios instance + all 24 API functions
│       │
│       ├── hooks/
│       │   └── useAuth.ts           # Auth state management hook
│       │
│       ├── types/
│       │   └── index.ts             # TypeScript types (incl. RAG, duplicate, suggestion types)
│       │
│       ├── pages/
│       │   ├── Auth.tsx             # Login / register page
│       │   ├── Home.tsx             # Topic listing + search + tags + debate suggestions
│       │   ├── CreateTopic.tsx      # New debate form
│       │   └── TopicDetail.tsx      # Three-column debate view (Discussion + Graph tabs)
│       │
│       └── components/
│           ├── ExplorerSidebar.tsx   # VSCode-style argument tree navigator
│           ├── ArgumentCard.tsx      # Comment-style argument display
│           ├── ArgumentGraph.tsx     # ReactFlow interactive graph
│           ├── ArgumentMapExpanded.tsx # Fullscreen map: 4 layouts, 4 color modes, analytics
│           ├── MapAnalytics.tsx      # Debate analytics panel (distributions, health, depth)
│           ├── BriefingRoom.tsx      # AI briefing display
│           ├── RAGQueryPanel.tsx     # "Ask the Debate" RAG query interface
│           ├── DuplicateCheckModal.tsx # Duplicate detection results modal
│           ├── DebateSuggestions.tsx  # Web search debate topic suggestions
│           ├── CatchUpModal.tsx      # Newcomer catch-up briefing modal
│           ├── SubmitArgumentForm.tsx # Argument form (full + inline modes)
│           ├── NodeTypeBadge.tsx     # Colored node type pill
│           └── StateBadge.tsx        # Argument state indicator
│
└── docs/
    ├── architecture.md              # System architecture & data flow
    ├── api-reference.md             # Complete API endpoint reference
    ├── data-model.md                # Database models, enums, relationships
    ├── graph-rag.md                 # Graph RAG pipeline technical docs
    └── frontend.md                  # Frontend architecture & components
```

---

## API Reference

Full interactive docs available at `http://localhost:8000/docs` when the backend is running. See [docs/api-reference.md](docs/api-reference.md) for the complete reference.

### Authentication

| Method | Endpoint              | Auth | Description              |
| ------ | --------------------- | :--: | ------------------------ |
| `POST` | `/api/users/register` |  —   | Register a new user      |
| `POST` | `/api/users/login`    |  —   | Login, receive JWT       |
| `GET`  | `/api/users/me`       |  ✓   | Get current user profile |

### Topics

| Method   | Endpoint                      | Auth | Description                                       |
| -------- | ----------------------------- | :--: | ------------------------------------------------- |
| `GET`    | `/api/topics`                 |  —   | List topics (filter by `tag`, `search`, `status`) |
| `POST`   | `/api/topics`                 |  ✓   | Create a new debate topic                         |
| `GET`    | `/api/topics/{id}`            |  —   | Get topic details                                 |
| `PATCH`  | `/api/topics/{id}`            |  ✓   | Update topic (creator only)                       |
| `DELETE` | `/api/topics/{id}`            |  ✓   | Delete topic (creator only, no arguments)         |
| `POST`   | `/api/topics/{id}/archive`    |  ✓   | Archive topic (creator only)                      |
| `POST`   | `/api/topics/lifecycle/check` |  —   | Run lifecycle check on all topics                 |
| `GET`    | `/api/topics/{id}/tracks`     |  —   | List discourse tracks                             |
| `POST`   | `/api/topics/{id}/tracks`     |  ✓   | Create a discourse track                          |
| `GET`    | `/api/topics/{id}/briefing`   |  —   | Get AI-generated briefing                         |
| `GET`    | `/api/topics/{id}/catch-up`   |  ~   | Newcomer catch-up (personalized if authenticated) |

### Arguments

| Method   | Endpoint                                          | Auth | Description                                         |
| -------- | ------------------------------------------------- | :--: | --------------------------------------------------- |
| `GET`    | `/api/topics/{id}/arguments`                      |  —   | List arguments (filter by `track_id`)               |
| `POST`   | `/api/topics/{id}/arguments`                      |  ✓   | Submit argument (AI classifies + assigns track)     |
| `GET`    | `/api/topics/{id}/arguments/graph`                |  —   | Get full graph data (nodes + edges for ReactFlow)   |
| `PATCH`  | `/api/topics/{id}/arguments/{arg_id}`             |  ✓   | Update argument (author only)                       |
| `DELETE` | `/api/topics/{id}/arguments/{arg_id}`             |  ✓   | Delete argument (author only, leaf only)            |
| `POST`   | `/api/topics/{id}/arguments/{arg_id}/transition`  |  ✓   | Transition argument state                           |
| `GET`    | `/api/topics/{id}/arguments/{arg_id}/transitions` |  ✓   | Get available state transitions                     |
| `POST`   | `/api/topics/{id}/arguments/lifecycle/dormant`    |  —   | Mark inactive arguments as dormant                  |
| `POST`   | `/api/topics/{id}/arguments/check-duplicate`      |  —   | Check for duplicate/rehashed arguments (Graph RAG)  |
| `POST`   | `/api/topics/{id}/arguments/rag-query`            |  —   | Ask analytical questions about a debate (Graph RAG) |
| `POST`   | `/api/topics/{id}/arguments/backfill-vectors`     |  —   | Backfill all arguments into ChromaDB vector store   |

### Suggestions

| Method | Endpoint           | Auth | Description                             |
| ------ | ------------------ | :--: | --------------------------------------- |
| `GET`  | `/api/suggestions` |  —   | Web search for debate topic suggestions |

Query params: `category` (geopolitical/technology/economic/social/environment), `q` (custom search), `limit` (1-10, default 5)

### Health

| Method | Endpoint      | Auth | Description                                    |
| ------ | ------------- | :--: | ---------------------------------------------- |
| `GET`  | `/api/health` |  —   | Server status + AI / vector store / web search |

---

## Configuration

All configuration is via environment variables in `backend/.env`:

| Variable            | Required | Default                 | Description                              |
| ------------------- | :------: | ----------------------- | ---------------------------------------- |
| `DATABASE_URL`      |    No    | `sqlite:///./logora.db` | SQLAlchemy database URL                  |
| `SECRET_KEY`        | **Yes**  | —                       | Secret key for JWT token signing         |
| `ANTHROPIC_API_KEY` |    No    | `""`                    | Anthropic API key for Claude AI features |
| `CLAUDE_MODEL`      |    No    | `claude-sonnet-4-6`     | Claude model to use                      |
| `FRONTEND_URL`      |    No    | `http://localhost:5173` | Frontend URL for CORS                    |

### Running Without AI

If `ANTHROPIC_API_KEY` is empty or not set, all AI features fall back to stub responses:

- **Classification** returns the user's self-selected node type with 0.85 confidence
- **Briefing** returns computed statistics (node counts, source ratios) without AI analysis
- **Summaries** return the first 50 characters of argument content
- **Track detection** skips auto-assignment
- **Duplicate detection** uses cosine similarity only (threshold: 0.85) without Claude reasoning
- **RAG Q&A** returns a context summary instead of an AI-synthesized answer
- **Catch-up** returns computed statistics without AI narrative
- **Web search framing** wraps article titles as questions instead of AI-reframing

The app is fully functional without AI — it just lacks the intelligent classification and summarization layer.

### Running Without ChromaDB

If ChromaDB or sentence-transformers fail to initialize, the vector store reports `available: false` on the health endpoint. RAG features (duplicate check, RAG query) will return empty results but won't crash. Arguments are still stored in SQLite and can be backfilled later.

---

## Documentation

Detailed technical documentation is available in the [`docs/`](docs/) directory:

| Document                               | Description                                                      |
| -------------------------------------- | ---------------------------------------------------------------- |
| [Architecture](docs/architecture.md)   | System architecture, data flow, component relationships          |
| [API Reference](docs/api-reference.md) | Complete endpoint reference with request/response schemas        |
| [Data Model](docs/data-model.md)       | Database tables, enums, relationships, state machine             |
| [Graph RAG](docs/graph-rag.md)         | Vector store, graph traversal, duplicate detection, RAG pipeline |
| [Frontend](docs/frontend.md)           | Frontend architecture, components, state management              |

---

## Roadmap

See the [GitHub Issues](https://github.com/aymanhaque001/logora/issues) for the full planned feature set, organized by priority tier:

### Tier 1 — Prevents Circular Debate

- ~~[#1 Duplicate / Rehash Detection](https://github.com/aymanhaque001/logora/issues/1)~~ ✅ — Graph RAG-powered duplicate detection with similarity thresholds and Claude reasoning
- ~~[#2 Newcomer "Catch Up" Briefing](https://github.com/aymanhaque001/logora/issues/2)~~ ✅ — AI-generated catch-up with established/refuted points, active debates, contribution opportunities
- [#3 Consensus / Resolution Markers](https://github.com/aymanhaque001/logora/issues/3) — mark branches as resolved to signal settled ground

### Tier 2 — Improves Debate Quality

- [#4 Steel-Man Prompts](https://github.com/aymanhaque001/logora/issues/4) — require understanding of opposing view before rebutting
- [#5 Cross-Topic Knowledge Graph](https://github.com/aymanhaque001/logora/issues/5) — link related arguments across debates
- [#6 Gap Analysis](https://github.com/aymanhaque001/logora/issues/6) — AI identifies unsupported claims and unanswered challenges

### Tier 3 — Engagement & Incentives

- [#7 Progression-Based Credibility](https://github.com/aymanhaque001/logora/issues/7) — reward novelty over volume
- [#8 Endorsement System](https://github.com/aymanhaque001/logora/issues/8) — "this represents my view" instead of "+1" comments
- [#9 Debate Digest / Export](https://github.com/aymanhaque001/logora/issues/9) — generate shareable "Wikipedia article" from any debate

---

## License

This project is unlicensed. All rights reserved.
