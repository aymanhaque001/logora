<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Claude_AI-191919?style=for-the-badge&logo=anthropic&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
</p>

# Logora

**A structured debate platform and knowledge base — so people don't argue in circles.**

Logora models debates as directed graphs of typed arguments, not flat comment threads. Arguments branch, synthesize, get challenged, and reach resolution. AI classifies contributions, detects patterns, and generates neutral briefings. The result is a living repository where newcomers can see what's been established, what's contested, and where they can most usefully contribute.

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
- [Roadmap](#roadmap)
- [License](#license)

---

## Why Logora?

Online debates suffer from three problems:

1. **Circular arguments** — people rehash the same points endlessly
2. **Lost context** — newcomers have no idea what's already been said
3. **Flat structure** — comment threads don't capture the actual logical structure of a debate

Logora solves these by treating debates as **knowledge graphs** instead of comment threads. Every argument is a typed node (assertion, counter, qualification, synthesis, etc.) connected by typed edges (supports, challenges, qualifies, refines). AI classifies contributions, generates neutral summaries, and identifies gaps. The debate becomes a persistent, structured knowledge base that grows more useful over time.

---

## Core Concepts

### Argument Graph

Debates are modeled as **directed acyclic graphs** of argument nodes, not flat threads. Each node has a semantic type:

| Node Type | Description |
|-----------|-------------|
| **Assertion** | A claim or position statement |
| **Counter** | Directly challenges another argument |
| **Qualification** | Adds nuance or conditions to an argument |
| **Exception** | Identifies edge cases where an argument doesn't hold |
| **Synthesis** | Combines multiple arguments into a higher-level insight |
| **Reframe** | Recontextualizes the debate from a different angle |
| **Open Question** | Raises an unanswered question for the community |
| **Concession** | Acknowledges validity of an opposing point |

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

| Action | Points |
|--------|:------:|
| Submit argument with sources | +2.0 |
| Submit argument without sources | +0.5 |
| Your argument receives engagement | +1.0 |
| Concede a point (intellectual honesty) | +3.0 |
| Someone concedes to your argument | +2.0 |

Credibility is displayed next to every user's name, creating a soft incentive for sourced, honest participation.

### AI Briefing Room

Claude generates a neutral analysis of each debate:

- **Summary** — what the debate is about and where it stands
- **Key positions** — the strongest arguments on each side, with strength ratings
- **Discourse health** — engagement quality, nuance level, echo chamber risk
- **Unaddressed gaps** — points that no one has responded to yet
- **Track summaries** — what's happening in each sub-theme

This runs without AI too — the system falls back to computed statistics when no API key is set.

---

## Features

- **Graph-based debate structure** — arguments as typed nodes with typed edges, not flat comments
- **Interactive argument map** — VSCode-style explorer sidebar with collapsible tree hierarchy
- **Comment-style feed** — threaded, scrollable argument cards with inline reply forms
- **AI classification** — Claude auto-classifies argument type, assigns tracks, generates summaries
- **AI briefings** — neutral debate analysis with health metrics and gap detection
- **State machine** — arguments progress through lifecycle states with auto and manual transitions
- **Credibility scoring** — rewards sourced arguments and intellectual honesty
- **Discourse tracks** — auto-detected sub-themes that organize complex debates
- **Nuance tags** — temporal, geographic, scale, conditional, population-specific, contested empirically
- **Source citations** — attach URLs with titles and descriptions to arguments
- **Topic lifecycle** — active → cooling (30 days no activity) → historical (archived)
- **Tag filtering** — geographic, social, economic, scientific, political, environmental
- **Dark theme** — full dark mode UI with indigo accents
- **JWT authentication** — secure token-based auth with bcrypt password hashing
- **Real-time graph visualization** — ReactFlow-powered interactive debate graph with dagre layout

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│                                                                 │
│  ┌──────────┐  ┌────────────────┐  ┌──────────────────────────┐ │
│  │ Explorer  │  │  Comment Feed  │  │   Briefing Room          │ │
│  │ Sidebar   │  │  (threaded)    │  │   + Track List           │ │
│  │ (tree)    │  │  + inline      │  │   + Health Metrics       │ │
│  │           │  │    reply forms  │  │                          │ │
│  └──────────┘  └────────────────┘  └──────────────────────────┘ │
│                                                                 │
│  React 18 · TypeScript · TanStack Query · ReactFlow · Tailwind  │
└────────────────────────────┬────────────────────────────────────┘
                             │ /api (Vite proxy)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI)                            │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │ Auth     │  │  REST API     │  │   AI Service               │ │
│  │ (JWT +   │  │  /users       │  │   Claude classification    │ │
│  │  bcrypt) │  │  /topics      │  │   Claude briefings         │ │
│  │          │  │  /arguments   │  │   Claude summaries         │ │
│  │          │  │  /graph       │  │   Track auto-detection     │ │
│  └──────────┘  └──────────────┘  └────────────────────────────┘ │
│                                                                 │
│  FastAPI · SQLAlchemy · Pydantic · Anthropic SDK                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   SQLite (local) │
                    │   logora.db      │
                    └──────────────────┘
```

---

## Tech Stack

### Backend
- **[FastAPI](https://fastapi.tiangolo.com/)** 0.115 — async Python web framework
- **[SQLAlchemy](https://www.sqlalchemy.org/)** 2.0 — ORM with SQLite
- **[Pydantic](https://docs.pydantic.dev/)** 2.9 — data validation and serialization
- **[Anthropic SDK](https://docs.anthropic.com/)** 0.34 — Claude AI integration
- **[python-jose](https://python-jose.readthedocs.io/)** — JWT token handling
- **[bcrypt](https://github.com/pyca/bcrypt)** 4.2 — password hashing
- **[Uvicorn](https://www.uvicorn.org/)** 0.30 — ASGI server

### Frontend
- **[React](https://react.dev/)** 18.3 — UI framework
- **[TypeScript](https://www.typescriptlang.org/)** 5.5 — type safety
- **[Vite](https://vitejs.dev/)** 5.4 — build tool and dev server
- **[TanStack React Query](https://tanstack.com/query)** 5 — data fetching & caching
- **[React Router](https://reactrouter.com/)** 6 — client-side routing
- **[ReactFlow](https://reactflow.dev/)** 11 — interactive graph visualization
- **[Tailwind CSS](https://tailwindcss.com/)** 3.4 — utility-first styling
- **[dagre](https://github.com/dagrejs/dagre)** 0.8 — automatic graph layout
- **[lucide-react](https://lucide.dev/)** — icons
- **[date-fns](https://date-fns.org/)** — date formatting
- **[axios](https://axios-http.com/)** — HTTP client

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
CLAUDE_MODEL=claude-sonnet-4-20250514
FRONTEND_URL=http://localhost:5173
```

> **Note:** The app works fully without an Anthropic API key. AI features (classification, briefings, summaries, track detection) will return sensible stub/computed responses instead.

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

---

## Seed Data

Load demo data with realistic arguments, sources, and users:

```bash
cd backend
source venv/bin/activate
python seed.py
```

This creates:

**5 Users** (all with password `password123`):

| Email | Name | Expert Domain | Credibility |
|-------|------|---------------|:-----------:|
| sarah@example.com | Sarah Chen | Urban Economics | 82 |
| marcus@example.com | Marcus Osei | Urban Planning | 79 |
| priya@example.com | Priya Sharma | — | 65 |
| david@example.com | David Kowalski | — | 58 |
| elena@example.com | Elena Vasquez | Sociology | 77 |

**3 Debate Topics** with 9 discourse tracks and ~40 arguments:

1. *"Is gentrification net harmful to low-income urban residents in major US cities?"* — 16 arguments across economic effects, housing, and policy tracks
2. *"Does increased low-skilled immigration depress wages for native low-income workers?"* — 8 arguments covering empirical evidence, methodology, and framing  
3. *"Should cities prioritise cycling infrastructure over car lanes in dense urban centres?"* — 8 arguments on emissions, equity, and economics

All arguments include real academic citations and demonstrate the full range of node types and states.

---

## Project Structure

```
logora/
├── start.sh                         # Start both servers
├── .gitignore
│
├── backend/
│   ├── run.py                       # Uvicorn entry point
│   ├── seed.py                      # Demo data seeder
│   ├── requirements.txt
│   ├── .env                         # Environment variables (not in git)
│   ├── .env.example                 # Template for .env
│   │
│   └── app/
│       ├── main.py                  # FastAPI app, CORS, router mounting
│       ├── config.py                # Pydantic settings (reads .env)
│       ├── database.py              # SQLAlchemy engine + session
│       ├── auth.py                  # JWT + bcrypt auth utilities
│       ├── models.py                # SQLAlchemy models (5 tables, 6 enums)
│       ├── schemas.py               # Pydantic request/response schemas
│       │
│       ├── routers/
│       │   ├── users.py             # /api/users — register, login, me
│       │   ├── topics.py            # /api/topics — CRUD, lifecycle, tracks, briefing
│       │   └── arguments.py         # /api/topics/{id}/arguments — CRUD, graph, transitions
│       │
│       └── services/
│           ├── ai_service.py        # Claude AI integration (classify, brief, summarize)
│           └── credibility.py       # Credibility scoring system
│
└── frontend/
    ├── package.json
    ├── vite.config.ts               # Vite config (proxy /api → :8000)
    ├── tailwind.config.js           # Dark theme tokens + animations
    ├── tsconfig.json
    ├── index.html
    │
    └── src/
        ├── main.tsx                 # React entry point
        ├── App.tsx                  # Auth gate, routing, navbar
        ├── index.css                # Global styles + Tailwind
        │
        ├── api/
        │   └── client.ts            # Axios instance + all API functions
        │
        ├── hooks/
        │   └── useAuth.ts           # Auth state management hook
        │
        ├── types/
        │   └── index.ts             # TypeScript types mirroring backend
        │
        ├── pages/
        │   ├── Auth.tsx             # Login / register page
        │   ├── Home.tsx             # Topic listing with search + tag filter
        │   ├── CreateTopic.tsx      # New debate form
        │   └── TopicDetail.tsx      # Three-column debate view
        │
        └── components/
            ├── ExplorerSidebar.tsx   # VSCode-style argument tree navigator
            ├── ArgumentCard.tsx      # Comment-style argument display
            ├── ArgumentGraph.tsx     # ReactFlow interactive graph
            ├── BriefingRoom.tsx      # AI briefing display
            ├── SubmitArgumentForm.tsx # Argument form (full + inline modes)
            ├── NodeTypeBadge.tsx     # Colored node type pill
            └── StateBadge.tsx        # Argument state indicator
```

---

## API Reference

Full interactive docs available at `http://localhost:8000/docs` when the backend is running.

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/users/register` | — | Register a new user |
| `POST` | `/api/users/login` | — | Login, receive JWT |
| `GET` | `/api/users/me` | ✓ | Get current user profile |

### Topics

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/api/topics` | — | List topics (filter by `tag`, `search`, `status`) |
| `POST` | `/api/topics` | ✓ | Create a new debate topic |
| `GET` | `/api/topics/{id}` | — | Get topic details |
| `PATCH` | `/api/topics/{id}` | ✓ | Update topic (creator only) |
| `DELETE` | `/api/topics/{id}` | ✓ | Delete topic (creator only, no arguments) |
| `POST` | `/api/topics/{id}/archive` | ✓ | Archive topic (creator only) |
| `GET` | `/api/topics/{id}/tracks` | — | List discourse tracks |
| `POST` | `/api/topics/{id}/tracks` | ✓ | Create a discourse track |
| `GET` | `/api/topics/{id}/briefing` | — | Get AI-generated briefing |
| `POST` | `/api/topics/lifecycle/check` | — | Run lifecycle check on all topics |

### Arguments

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/api/topics/{id}/arguments` | — | List arguments (filter by `track_id`) |
| `POST` | `/api/topics/{id}/arguments` | ✓ | Submit argument (AI classifies + assigns track) |
| `GET` | `/api/topics/{id}/arguments/graph` | — | Get full graph data (nodes + edges for ReactFlow) |
| `PATCH` | `/api/topics/{id}/arguments/{arg_id}` | ✓ | Update argument (author only) |
| `DELETE` | `/api/topics/{id}/arguments/{arg_id}` | ✓ | Delete argument (author only, leaf only) |
| `POST` | `/api/topics/{id}/arguments/{arg_id}/transition` | ✓ | Transition argument state |
| `GET` | `/api/topics/{id}/arguments/{arg_id}/transitions` | ✓ | Get available state transitions |
| `POST` | `/api/topics/{id}/arguments/lifecycle/dormant` | — | Mark inactive arguments as dormant |

### Health

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/api/health` | — | Server status + AI availability |

---

## Configuration

All configuration is via environment variables in `backend/.env`:

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `DATABASE_URL` | No | `sqlite:///./logora.db` | SQLAlchemy database URL |
| `SECRET_KEY` | **Yes** | — | Secret key for JWT token signing |
| `ANTHROPIC_API_KEY` | No | `""` | Anthropic API key for Claude AI features |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-20250514` | Claude model to use |
| `FRONTEND_URL` | No | `http://localhost:5173` | Frontend URL for CORS |

### Running Without AI

If `ANTHROPIC_API_KEY` is empty or not set, all AI features fall back to stub responses:

- **Classification** returns the user's self-selected node type with 0.85 confidence
- **Briefing** returns computed statistics (node counts, source ratios) without AI analysis
- **Summaries** return the first 50 characters of argument content
- **Track detection** skips auto-assignment

The app is fully functional without AI — it just lacks the intelligent classification and summarization layer.

---

## Roadmap

See the [GitHub Issues](https://github.com/aymanhaque001/logora/issues) for the full planned feature set, organized by priority tier:

### Tier 1 — Prevents Circular Debate
- [#1 Duplicate / Rehash Detection](https://github.com/aymanhaque001/logora/issues/1) — AI detects when a user is about to restate an existing argument
- [#2 Newcomer "Catch Up" Briefing](https://github.com/aymanhaque001/logora/issues/2) — personalized onboarding summary for first-time topic visitors
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
