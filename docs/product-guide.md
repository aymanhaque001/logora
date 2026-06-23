# Crux — Product Guide

### The Argument Intelligence Platform

> _Reddit shows you what's popular. Crux shows you what's true._

---

## What Is Crux?

Crux is a platform where people debate ideas — and the debate actually goes somewhere.

Instead of flat comment threads where the loudest voice wins, Crux maps every argument into a **structured knowledge graph**. AI classifies each contribution, detects when someone is repeating a point that's already been made, generates neutral summaries of where the debate stands, and lets anyone ask questions about a discussion and get grounded, citation-backed answers.

The result: debates that accumulate knowledge over time instead of going in circles.

---

## The Problem We Solve

Every discussion platform today has the same three failures:

| Problem                     | What Happens                                                                           | Example                                                              |
| --------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Circular arguments**      | The same points get rehashed endlessly because nobody can see what's already been said | Every Reddit thread about gun control, immigration, or AI regulation |
| **Popularity over quality** | Upvotes reward wit and timing, not depth and evidence                                  | A joke gets 5,000 upvotes; a sourced 500-word analysis gets 200      |
| **Lost context**            | New participants have no idea what's been established, refuted, or left unresolved     | Joining a 2,000-comment thread and having to read everything         |

**Crux fixes all three.** Arguments are typed and tracked. Duplicates are caught before posting. AI keeps a running summary. Newcomers get a personalized catch-up brief.

---

## How It Works

### 1. Someone frames a question

A debate starts with a canonical question:

> _"Should cities ban personal car ownership in urban centers?"_

They add context, select relevant tags (economic, environmental, social...), and optionally specify a geographic focus.

### 2. People submit arguments

Each contribution is more than just a reply — it's a **typed argument** with a specific role in the debate:

| Type              | What It Does                         | Example                                                                              |
| ----------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| **Assertion**     | Makes a positive claim               | _"Banning cars would reduce emissions by 40% in dense cities"_                       |
| **Counter**       | Directly challenges another argument | _"That 40% figure assumes perfect public transit, which no city has"_                |
| **Qualification** | Adds nuance or conditions            | _"True for cities over 1M population, but smaller cities lack transit alternatives"_ |
| **Exception**     | Identifies edge cases                | _"This breaks down for disabled residents who depend on personal vehicles"_          |
| **Synthesis**     | Combines perspectives                | _"Both sides agree that congestion pricing is a reasonable middle step"_             |
| **Reframe**       | Changes the lens                     | _"The real question isn't car ownership — it's who bears the cost of transition"_    |
| **Open Question** | Raises something unaddressed         | _"Has anyone studied the economic impact on auto workers in affected regions?"_      |
| **Concession**    | Acknowledges the other side          | _"I concede that the timeline I proposed was unrealistic"_                           |

**You don't have to choose.** When you submit an argument, AI automatically classifies what type it is. You can override it if you disagree.

### 3. Arguments form a knowledge graph

Arguments aren't just stacked in a thread — they're connected by **typed relationships**:

- **Supports** — reinforces another argument
- **Challenges** — directly opposes it
- **Qualifies** — adds conditions or limits
- **Refines** — improves upon it
- **Contradicts** — logically incompatible
- **Synthesizes** — bridges multiple arguments
- **Questions** — probes for more detail

The result is a visual map you can explore, zoom into, and analyze — not a wall of text.

### 4. AI keeps the debate healthy

Behind the scenes, AI continuously:

- **Classifies** each new argument (what type is it? what discourse track does it belong to?)
- **Catches duplicates** before they're posted ("This is 87% similar to an existing argument — here's how to differentiate")
- **Generates briefings** ("Here's a neutral summary of all positions, areas of agreement, and unresolved tensions")
- **Creates catch-up briefs** for newcomers ("Here's what's been established, what's been refuted, and where you can contribute")
- **Answers questions** about the debate ("What's the strongest counter-argument to position X?" → grounded answer with citations)

### 5. The debate evolves

Arguments have **lifecycle states** that track how the conversation progresses:

| State            | What It Means                                    |
| ---------------- | ------------------------------------------------ |
| **Unchallenged** | Nobody has responded yet                         |
| **Engaged**      | Someone has countered or qualified it            |
| **Refined**      | The author updated their position after feedback |
| **Branched**     | It's spawned its own sub-debate                  |
| **Conceded**     | The author acknowledged a valid counter-argument |
| **Dormant**      | No activity for 30 days                          |

Conceding a point is **rewarded**, not punished. Changing your mind in the face of evidence is the highest-credit action on the platform.

---

## Key Features

### The Argument Graph

Every debate is visualized as an interactive map. Nodes are arguments, edges are relationships. You can:

- **Explore visually** — zoom, pan, click any node to read the full argument
- **Switch layouts** — top-down tree, left-right flow, radial, or clustered by theme
- **Color by meaning** — color nodes by type (assertion, counter...), state (unchallenged, engaged...), age (new vs. old), or connectivity (how central the argument is)
- **See analytics** — contention ratio, average depth, most-connected arguments, sourced vs. unsourced breakdown

### "Ask the Debate" (AI Q&A)

Type a natural language question about any debate and get a synthesized answer grounded in the actual arguments:

> **You ask:** _"What are the main economic risks identified?"_
>
> **Crux answers:** _"Three economic risks have been identified across 14 arguments: (1) job displacement in the auto sector [supported by 3 arguments with sources], (2) decreased property values outside transit zones [one counter-argument notes this may reverse long-term], and (3) implementation costs exceeding $2B [unchallenged, flagged as needing more data]."_

This works because Crux doesn't just search text — it traverses the argument graph to find structurally relevant context, then synthesizes it.

### AI Briefing Room

Every debate has an AI-generated briefing that stays current:

- **Summary** — Neutral overview of the debate state
- **Key Positions** — The strongest arguments on each side, with strength ratings
- **Discourse Health** — Is the conversation productive? Are people engaging in good faith? Is there an echo chamber risk?
- **Gaps** — What hasn't been addressed yet?
- **Track Summaries** — Breakdown by sub-theme (economic impacts, social equity, environmental effects...)

### Newcomer Catch-Up

Joining a debate that's been going for weeks? The catch-up brief tells you:

- **What's established** — Points that have broad support and evidence
- **What's been refuted** — Claims that have been effectively countered
- **What's still contested** — Active disagreements
- **Where you can contribute** — Specific gaps, unchallenged claims, and unanswered questions where your input would be most valuable

### Duplicate Detection

Before you post, the system checks if your argument is too similar to an existing one. If it is, you'll see:

- The similar argument (with similarity percentage)
- An AI suggestion for how to differentiate your point
- The option to proceed anyway, edit, or cancel

This is how Crux prevents debates from going in circles.

### Credibility System

Your credibility score (0–100) reflects the quality of your contributions, not their popularity:

| Action                                     | Effect        |
| ------------------------------------------ | ------------- |
| Submit an argument with sources            | +2 points     |
| Submit without sources                     | +0.5 points   |
| Your argument gets engagement              | +1 point      |
| You concede a point (intellectual honesty) | **+3 points** |
| Someone concedes to your argument          | +2 points     |

The highest-rewarded action is **changing your mind when presented with evidence.** This is by design.

### Live News & Debate Suggestions

The home page features:

- **News Ticker** — Real-time headlines from global sources, with a "Debate This" button to instantly create a debate from any news story
- **AI Debate Suggestions** — AI-framed topic ideas across 5 categories (geopolitical, tech, economic, social, environmental) sourced from current events

### Discourse Tracks

Large debates naturally split into sub-themes. Crux detects these automatically (or lets you create them manually):

- _Economic impacts_
- _Social equity concerns_
- _Environmental projections_
- _Implementation feasibility_

Each track has its own argument tree, and the briefing room summarizes each separately.

---

## What Makes Crux Different

| Feature                    | Reddit                | Twitter/X          | Kialo         | Slack            | **Crux**                            |
| -------------------------- | --------------------- | ------------------ | ------------- | ---------------- | ------------------------------------- |
| Argument structure         | Flat threads          | Flat threads       | Pro/Con tree  | Flat chat        | **8 typed nodes, 7 edge types**       |
| Quality signal             | Upvotes (popularity)  | Likes/retweets     | Simple voting | None             | **Merit-based credibility**           |
| AI analysis                | None                  | None               | None          | None             | **Classification, briefings, health** |
| Query a discussion         | Text search           | Text search        | None          | Text search      | **Graph RAG (structured answers)**    |
| Duplicate prevention       | None (repost culture) | None               | None          | None             | **AI duplicate detection**            |
| Newcomer onboarding        | Read everything       | Scroll timeline    | Read the tree | Read the history | **AI catch-up briefing**              |
| Rewards changing your mind | Punished (downvoted)  | Punished (ratio'd) | Not tracked   | N/A              | **Highest-rewarded action**           |

---

## Use Cases

### Public Discourse

Host structured debates on policy, technology, science, or social issues. Build a knowledge base that grows more useful over time instead of recycling the same arguments every week.

### Team Decision-Making

Map out a strategic decision: "Should we enter the European market?" Every stakeholder submits their position. AI synthesizes where the team agrees and disagrees. Six months later, anyone can query the decision to understand the reasoning.

### Education

Students practice argumentation in a structured environment. AI classifies their argument types, catches logical weaknesses, and tracks skill development through credibility scores over time.

### Research & Policy

Map the argument landscape around a policy proposal. See all positions, evidence, and counter-evidence in one place. Export structured summaries for reports and briefs.

---

## Tags & Categories

Debates are tagged for discoverability:

| Tag               | Topics                                   |
| ----------------- | ---------------------------------------- |
| **Geographic**    | Regional issues, international relations |
| **Social**        | Equity, justice, culture, rights         |
| **Economic**      | Markets, policy, trade, development      |
| **Scientific**    | Research, technology, methodology        |
| **Political**     | Governance, elections, legislation       |
| **Environmental** | Climate, sustainability, resources       |

---

## Nuance Tags

Arguments can carry nuance markers that flag important qualifiers:

| Tag                       | Meaning                             | Example                                          |
| ------------------------- | ----------------------------------- | ------------------------------------------------ |
| **Temporal**              | True at one time, not another       | _"This was true before the 2024 policy change"_  |
| **Geographic**            | Applies in some regions, not others | _"This holds in Europe but not Southeast Asia"_  |
| **Scale**                 | Different at different levels       | _"Works locally, reverses at national scale"_    |
| **Conditional**           | Depends on a specific condition     | _"Only if interest rates stay below 5%"_         |
| **Population-Specific**   | Applies to some groups, not all     | _"True for urban renters, not rural homeowners"_ |
| **Contested Empirically** | Experts actively disagree           | _"The data on this is inconclusive"_             |

---

## The Technology (Brief)

Crux is built with:

- **Backend:** FastAPI (Python) with SQLAlchemy ORM
- **Frontend:** React + TypeScript with Tailwind CSS
- **AI:** Claude (Anthropic) for classification, briefings, and synthesis
- **Vector Search:** ChromaDB with sentence-transformer embeddings
- **Graph Visualization:** ReactFlow with dagre layout engine
- **Data Fetching:** TanStack React Query with optimistic updates

The platform runs without AI features if no API key is configured — all AI functions gracefully degrade to computed or stub responses.

---

## Getting Started

### For Users

1. Create an account or log in
2. Browse active debates on the home page, or create a new one
3. Click into a debate to read the briefing, explore the argument graph, or dive into the discussion
4. Submit arguments — AI will classify them and check for duplicates
5. Ask questions about any debate using "Ask the Debate"
6. Build your credibility by contributing quality, sourced arguments — and by being willing to change your mind

### For Developers

See the [README](../README.md) for installation, setup, and API reference.
Full technical documentation is available in the [docs/](../docs/) directory.

---

## Open Source

Crux is open source and available at [github.com/aymanhaque001/crux](https://github.com/aymanhaque001/crux).

Contributions welcome. See the [GitHub Issues](https://github.com/aymanhaque001/crux/issues) for the roadmap.

---

_Built by Ayman Haque · 2026_
