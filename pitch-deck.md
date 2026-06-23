---
marp: true
theme: uncover
class: invert
paginate: true
backgroundColor: #0f172a
color: #e2e8f0
style: |
  section {
    font-family: 'Inter', 'Helvetica Neue', sans-serif;
  }
  h1 {
    color: #38bdf8;
    font-size: 2.2em;
  }
  h2 {
    color: #7dd3fc;
    font-size: 1.6em;
  }
  strong {
    color: #38bdf8;
  }
  table {
    font-size: 0.75em;
  }
  th {
    background-color: #1e3a5f;
    color: #7dd3fc;
  }
  td {
    background-color: #1e293b;
  }
  blockquote {
    border-left: 4px solid #38bdf8;
    background: #1e293b;
    padding: 0.5em 1em;
    font-style: italic;
    color: #94a3b8;
  }
  code {
    background: #1e293b;
    color: #38bdf8;
  }
  a {
    color: #38bdf8;
  }
  .small {
    font-size: 0.65em;
    color: #64748b;
  }
---

<!-- _class: lead invert -->

# **Crux**

### The Argument Intelligence Platform

_Reddit shows you what's popular. Crux shows you what's true._

<br>

**Ayman Haque** · Founder
March 2026

---

# The Problem

Every day, **critical decisions** are made through unstructured debate.

- Teams argue in Slack threads, meeting notes, and slide decks
- Online discourse devolves into popularity contests
- **Brilliant arguments get buried** under noise, jokes, and mob voting
- 6 months later, nobody can explain _why_ a decision was made

> Organizations spend **$300B+/year** on management consulting to structure their thinking. What if software could do it?

---

# The Deeper Problem

### Existing platforms optimize for engagement, not insight

| Platform              | What It Optimizes      | What Gets Lost                             |
| --------------------- | ---------------------- | ------------------------------------------ |
| **Reddit**            | Popularity (upvotes)   | Nuanced, unpopular-but-correct arguments   |
| **Slack/Teams**       | Speed (real-time chat) | Structured reasoning, decision audit trail |
| **Notion/Confluence** | Documentation          | The _reasoning process_ behind decisions   |
| **Twitter/X**         | Virality (shares)      | Depth, evidence, good-faith disagreement   |

**Nobody builds for argument quality.** We do.

---

# The Solution

## Crux turns unstructured human disagreement into a searchable, AI-analyzed knowledge graph

<br>

**Three things no one else combines:**

1. **Typed Argument Graphs** — 8 node types, 7 relationship types, lifecycle state machine
2. **Graph RAG** — Ask any debate a question, get synthesized, citation-backed answers
3. **AI Discourse Health** — Automated briefings, contention mapping, quality scoring

---

# How It Works

### 1. Frame the Question

_"Should we expand into the European market?"_

### 2. Map the Arguments

Team members submit positions — AI classifies each as assertion, counter, qualification, synthesis, etc.

### 3. AI Analyzes the Landscape

Automated briefing: key positions, areas of agreement, unresolved tensions, discourse health score

### 4. Ask the Debate

_"What's the strongest argument against expansion?"_
→ Graph RAG traverses the argument structure and returns a grounded answer

---

# The "Ask the Debate" Moment

### This is our killer feature. No one else can do this.

<br>

**User asks:** _"What are the main risks of Option B?"_

**Crux answers:**

> Based on 23 arguments across 3 discourse tracks, the primary risks identified are: (1) regulatory uncertainty in the EU market [supported by 4 arguments, 2 with sources], (2) supply chain fragmentation [challenged by 1 counter-argument citing recent trade agreements], and (3) talent acquisition costs [unchallenged, flagged as needing more analysis].

<br>

Reddit can't do this. Slack can't do this. No one can — because their data is unstructured text. **Ours is a knowledge graph.**

---

# Product Demo

### Dashboard

![bg right:55% 90%](https://via.placeholder.com/600x400/1e293b/38bdf8?text=Dashboard+Screenshot)

- Live news ticker with "Debate This"
- Active debates with search & tag filters
- Quick RAG query across all topics
- AI-powered debate suggestions

---

# Product Demo

### Argument Graph

![bg right:55% 90%](https://via.placeholder.com/600x400/1e293b/38bdf8?text=Argument+Graph+Screenshot)

- Visual argument map with typed nodes
- 4 layout modes, 4 color schemes
- Analytics sidebar: contention ratio, depth, connectivity
- Expand to fullscreen with minimap

---

# Product Demo

### AI Briefing Room

![bg right:55% 90%](https://via.placeholder.com/600x400/1e293b/38bdf8?text=Briefing+Room+Screenshot)

- Auto-generated neutral summary
- Key positions from all sides
- Discourse health score
- Newcomer catch-up briefings
- "Ask the Debate" with retrieval stats

---

# Technology

### The AI Pipeline That Powers It

```
User submits argument
    → AI classifies (node type, nuance tags, confidence)
    → Duplicate detection (vector search + graph expansion + LLM)
    → Vector embedding stored in ChromaDB
    → Graph edges created automatically
    → Briefings regenerated
    → RAG index updated
```

**Stack:** FastAPI · React/TypeScript · ChromaDB · Claude (Anthropic) · SQLAlchemy · ReactFlow · TanStack Query · Tailwind CSS

---

# The Moat

### Why this is hard to replicate

<br>

| Layer                     | Defensibility                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Typed Argument Graph**  | 8 node types × 7 edge types × 7 lifecycle states = complex domain model competitors must rebuild from scratch                   |
| **Graph RAG**             | Vector search + BFS graph expansion + LLM synthesis on _structured argumentation_ — novel method, no existing library does this |
| **Accumulated Knowledge** | Every argument makes the platform smarter. After 1 year, the knowledge graph is irreplaceable                                   |
| **Network Effects**       | Arguments reference other arguments. Users build credibility over time. Switching costs increase with usage                     |

---

# Market Opportunity

### Two markets, one platform

<br>

**Market 1: Enterprise Decision Intelligence**

- $300B+ management consulting market
- Every Fortune 500 strategy team needs structured decision-making
- TAM: ~50,000 enterprise strategy teams × $20K/year = **$1B**

**Market 2: Quality Discourse Platform**

- 10M+ "serious Reddit" users frustrated with upvote-driven discourse
- r/changemyview alone: 3.5M subscribers manually enforcing what we automate
- TAM: 10M users × $60/year premium = **$600M**

---

# Go-To-Market

### Phase 1: Enterprise (Months 1-6)

**"Crux Teams"** — Private workspaces for team decision-making

| Tier       | Price       | Target                                      |
| ---------- | ----------- | ------------------------------------------- |
| Free       | $0          | 1 workspace, 3 members, 5 decisions         |
| Pro        | $49/mo      | Unlimited decisions, 10 members, PDF export |
| Team       | $19/seat/mo | Unlimited everything, SSO, audit log        |
| Enterprise | Custom      | On-prem, integrations, dedicated support    |

**First customers:** Internal strategy teams at mid-market companies ($100M-$1B revenue). VP Strategy / Chief of Staff buyers. 3-5 free pilots → case studies → scale.

---

# Go-To-Market

### Phase 2: Community Platform (Months 6-18)

**Open-source public platform** — The "Wikipedia of Argumentation"

- Seed with 3-5 high-quality topic verticals (AI policy, climate, economics)
- Target r/changemyview, r/NeutralPolitics, r/geopolitics power users
- Open source = free distribution + community trust
- Monetize with premium features: advanced analytics, API access, ad-free

**Flywheel:** Open source builds brand → Brand drives enterprise leads → Enterprise revenue funds platform growth

---

# Competitive Landscape

|                    | Kialo         | Pol.is          | Reddit             | Slack | **Crux**      |
| ------------------ | ------------- | --------------- | ------------------ | ----- | --------------- |
| Argument types     | Pro/Con       | None            | None               | None  | **8 types**     |
| AI analysis        | ❌            | ❌              | ❌                 | ❌    | **✅**          |
| Graph RAG          | ❌            | ❌              | ❌                 | ❌    | **✅**          |
| Query a debate     | ❌            | ❌              | ❌                 | ❌    | **✅**          |
| Discourse health   | ❌            | Voting clusters | ❌                 | ❌    | **✅**          |
| Credibility system | Simple voting | ❌              | Karma (popularity) | ❌    | **Merit-based** |
| Enterprise ready   | ❌            | ❌              | ❌                 | ✅    | **Roadmap**     |

---

# Traction

### Built and shipped in < 3 months (solo developer)

<br>

- ✅ **Full-stack platform** — FastAPI + React/TypeScript, production-ready
- ✅ **26 API endpoints** — Complete CRUD + AI pipeline
- ✅ **Graph RAG pipeline** — ChromaDB + graph expansion + Claude synthesis
- ✅ **6 AI functions** — Classification, briefings, duplicate detection, catch-up, summarization, track detection
- ✅ **16 React components** — Argument graph, briefing room, analytics, news ticker
- ✅ **Open source** — github.com/aymanhaque001/crux
- 🎯 **Next:** 3-5 enterprise pilot customers in 90 days

---

# Roadmap

### Next 12 Months

| Quarter     | Milestone                                                        |
| ----------- | ---------------------------------------------------------------- |
| **Q2 2026** | Enterprise MVP (private workspaces, PDF export, team management) |
| **Q2 2026** | 3-5 pilot customers, first case studies                          |
| **Q3 2026** | AI Devil's Advocate, Fallacy Detection, Consensus Tracking       |
| **Q3 2026** | Mobile responsive, real-time updates (SSE)                       |
| **Q4 2026** | Public platform launch, community seeding                        |
| **Q4 2026** | Cross-topic knowledge graph, argument strength scoring           |
| **Q1 2027** | Scale to 50 enterprise customers, 10K community users            |

---

# The Team

<br>

### **Ayman Haque** — Founder & Builder

- Full-stack engineer: Python, TypeScript, React, AI/ML
- Built Crux end-to-end: backend, frontend, AI pipeline, Graph RAG
- Designed the typed argumentation model and discourse health system

<br>

### Hiring Next

- **Head of Sales** — Enterprise GTM, strategy/consulting industry connections
- **Senior Frontend** — Mobile, real-time, polish
- **AI/ML Engineer** — Scale RAG pipeline, fine-tune classification

---

# The Ask

<br>

### Seeking **$500K pre-seed** to:

| Use of Funds              | Allocation |
| ------------------------- | ---------- |
| Engineering (hire 2)      | 50%        |
| Sales & GTM               | 25%        |
| Infrastructure & AI costs | 15%        |
| Legal & operations        | 10%        |

<br>

### **18-month runway** to reach:

- 50 enterprise customers ($500K ARR)
- 10,000 community platform users
- Series A ready

---

<!-- _class: lead invert -->

# **Crux**

### Turning disagreement into intelligence.

<br>

_"Reddit shows you what's popular._
_ChatGPT forgets what you said._
_Crux accumulates, structures, and lets you query_
_the collective reasoning of every participant."_

<br>

**ayman@crux.io** · github.com/aymanhaque001/crux

---

# Appendix: Technical Architecture

```
┌─────────────────────────────────────────────────┐
│                  React Frontend                  │
│  Dashboard · Argument Graph · Briefing Room     │
│  RAG Query · Analytics · News Ticker            │
├─────────────────────────────────────────────────┤
│              FastAPI Backend (26 endpoints)       │
├──────────┬──────────┬──────────┬────────────────┤
│  Topics  │Arguments │  Auth    │   AI Service   │
│  Router  │ Router   │ (JWT)    │  (Claude API)  │
├──────────┴──────────┴──────────┴────────────────┤
│         SQLAlchemy ORM + SQLite/PostgreSQL        │
├─────────────────────┬───────────────────────────┤
│     ChromaDB        │   Graph RAG Pipeline      │
│  (Vector Store)     │  (BFS + Merge + LLM)      │
└─────────────────────┴───────────────────────────┘
```

---

# Appendix: Graph RAG — The Core Innovation

```
Query: "What's the strongest counter to market expansion?"

Step 1: VECTOR SEARCH
  → Embed query → cosine similarity → top 10 argument matches

Step 2: GRAPH EXPANSION
  → For each match, BFS traverse typed edges (2 hops, 30 node cap)
  → Follow supports, challenges, qualifies, refines edges
  → Capture structural context (parent chains, counter-arguments)

Step 3: MERGE & DEDUPLICATE
  → Combine vector results + graph results
  → Remove duplicates, cap at context window

Step 4: LLM SYNTHESIS
  → Feed structured context to Claude
  → Generate grounded answer with argument citations
  → Include retrieval statistics and confidence
```

**This method is novel.** RAG on documents exists. RAG on typed argumentation graphs doesn't.

---

# Appendix: Data Model

```
users ──────────────┐
  credibility_score  │
  is_verified_expert │
                     ▼
topics ─────────── argument_nodes ──── argument_edges
  canonical_question   node_type (8)      relationship_type (7)
  tags (6 categories)  state (7)          source_id → target_id
  status (3)           nuance_tags (6)
  location             ai_confidence
                       ai_summary
                     │
                     ▼
              discourse_tracks
                name
                auto_detected
```

**5 tables · 6 enums · 8 node types · 7 edge types · 7 lifecycle states**

---

# Appendix: Unit Economics

| Metric                             | Value                                       |
| ---------------------------------- | ------------------------------------------- |
| **AI cost per argument**           | ~$0.005 (classification + summarization)    |
| **AI cost per briefing**           | ~$0.02 (with caching: $0.002)               |
| **AI cost per RAG query**          | ~$0.03                                      |
| **Avg. enterprise usage**          | ~200 arguments/mo, 20 briefings, 50 queries |
| **Monthly AI cost per customer**   | ~$2.60                                      |
| **Team tier revenue per 10 seats** | $190/mo                                     |
| **Gross margin**                   | **~98%**                                    |

<br>

_AI costs are negligible relative to SaaS pricing. The margin story is strong._
