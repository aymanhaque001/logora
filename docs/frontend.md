# Frontend Architecture

> Frontend architecture, component hierarchy, state management, and UI documentation.

---

## Overview

The Crux frontend is a React 18 SPA built with TypeScript, Vite, and Tailwind CSS. Data fetching uses TanStack React Query with axios. Graph visualization uses ReactFlow with dagre for automatic layout.

**Design System:**

- Dark theme with surfaces ranging from `#0d0f11` to `#2a2f38`
- Accent color: indigo (`#6366f1`)
- Font: system font stack (Inter preferred)
- Icons: lucide-react

---

## Page Structure

### Auth Page (`Auth.tsx`)

Login and register forms with tab switching. Redirects to Home on success.

### Home Page (`Home.tsx`)

Dashboard-style layout with four zones:

```
┌────────────────────────────────────────────────────────────┐
│                  Live News Ticker                       │
│  Auto-scrolling headlines · "Debate This" buttons       │
│  Pause on hover · Manual scroll arrows                  │
├────────────────────────────────────────────────────────────┤
│                Ask the Debates (RAG Query)               │
│  Topic picker + query input → Graph RAG answers         │
├─────────────────────────────┬──────────────────────────────┤
│      Active Debates        │    Suggested Debates       │
│                            │                            │
│  Search + tag filters      │  Category tabs + search    │
│  Scrollable topic cards    │  AI-framed from news       │
│  "New Debate" button       │  "Create" buttons          │
└─────────────────────────────┴──────────────────────────────┘
```

| Zone              | Component           | Description                                                                    |
| ----------------- | ------------------- | ------------------------------------------------------------------------------ |
| News Ticker       | `NewsTicker`        | Auto-scrolling horizontal news cards from DuckDuckGo, "Debate This" buttons    |
| RAG Query         | `HomeRAGQuery`      | Topic dropdown + query input, Graph RAG answers with retrieval stats           |
| Active Debates    | Inline (Home.tsx)   | Topic cards with search, tag filters, status indicators, "New Debate" link     |
| Suggested Debates | `DebateSuggestions` | AI-framed debate suggestions from news with category tabs and "Create" buttons |

### Create Topic Page (`CreateTopic.tsx`)

Form for creating a new debate topic with canonical question, description, tags, and location.

### Topic Detail Page (`TopicDetail.tsx`)

The main debate view. Three-column layout:

```
┌─────────────┬──────────────────────────────┬─────────────────┐
│  LEFT       │          CENTER              │     RIGHT       │
│  SIDEBAR    │                              │     SIDEBAR     │
│  272px      │          flex                │     320px       │
│             │                              │                 │
│ Explorer    │  ┌────────┬──────────┐       │  Briefing Room  │
│ Sidebar     │  │Discuss.│Graph View│       │  (collapsible)  │
│ (tree       │  ├────────┴──────────┤       │                 │
│  navigator) │  │                   │       │  Tracks List    │
│             │  │ Argument cards    │       │  (with counts)  │
│ Toggleable  │  │ (threaded, with   │       │                 │
│ via button  │  │  inline reply)    │       │  RAG Query      │
│             │  │                   │       │  Panel          │
│             │  │ — OR —            │       │  "Ask the       │
│             │  │                   │       │   Debate"       │
│             │  │ ReactFlow graph   │       │                 │
│             │  │ (with expand      │       │                 │
│             │  │  button)          │       │                 │
│             │  └───────────────────┘       │                 │
└─────────────┴──────────────────────────────┴─────────────────┘
```

**Header actions:**

- Back button
- Topic tags, location, status badges
- **Focus Mode** — opens fullscreen argument map
- **Catch Up** — opens newcomer catch-up modal
- Archive / Delete (creator only, conditional)
- Sidebar toggle

**Tabs:**

- **Discussion** — threaded comment tree with `ArgumentCard` components and inline reply forms (`SubmitArgumentForm`)
- **Graph View** — `ArgumentGraph` ReactFlow visualization with expand button

**Modals/Overlays:**

- `CatchUpModal` — auto-shown for newcomers, manually triggered via header button
- `ArgumentMapExpanded` — fullscreen graph with analytics, triggered via "Focus Mode"

---

## Component Reference

### Core Debate Components

#### `ExplorerSidebar`

VSCode-style tree navigator showing the argument hierarchy. Each node shows:

- Node type badge (colored pill)
- AI-generated summary (or content truncation)
- State indicator
- Click navigates/highlights in center panel

#### `ArgumentCard`

Comment-style card for displaying an argument. Shows:

- Author name, credibility score, timestamp
- Node type badge, state badge, nuance tags
- Full content text
- Source citations (expandable)
- AI classification confidence
- Inline reply button (opens `SubmitArgumentForm` in inline mode)
- State transition controls (for argument author)
- Children rendered recursively (threaded)

#### `SubmitArgumentForm`

Dual-mode argument submission form:

- **Full mode** — standalone form at top of Discussion tab for root arguments
- **Inline mode** — compact form that appears inside `ArgumentCard` for replies

Fields: content (textarea, min 20 chars), node type selector, edge relationship (replies only), nuance tags (multi-select), sources (dynamic list).

On submit:

1. If content exists, calls `checkDuplicate()` first
2. If duplicate detected → shows `DuplicateCheckModal`
3. If original or user proceeds → submits via `submitArgument()`

#### `ArgumentGraph`

ReactFlow-powered interactive argument graph. Uses dagre for automatic hierarchical layout.

- Nodes colored by node type
- Edges colored by relationship type
- Click node → highlights corresponding argument card
- **Expand button** → opens `ArgumentMapExpanded` fullscreen overlay

### Visualization Components

#### `ArgumentMapExpanded`

Fullscreen overlay with advanced graph visualization and analytics.

**Props:**

| Prop          | Type                   | Description                         |
| ------------- | ---------------------- | ----------------------------------- |
| `graphNodes`  | `GraphNode[]`          | All nodes from graph API            |
| `graphEdges`  | `GraphEdge[]`          | All edges from graph API            |
| `tracks`      | `DiscourseTrack[]`     | Discourse tracks for cluster layout |
| `onClose`     | `() => void`           | Close the overlay                   |
| `onNodeClick` | `(id: string) => void` | Handle node selection               |

**Layout Modes:**

| Mode       | Key             | Description                                                |
| ---------- | --------------- | ---------------------------------------------------------- |
| Top-Down   | `hierarchy-tb`  | Dagre top-to-bottom hierarchical layout                    |
| Left-Right | `hierarchy-lr`  | Dagre left-to-right hierarchical layout                    |
| Radial     | `radial`        | Concentric circles with root nodes at center               |
| By Track   | `cluster-track` | Groups nodes by discourse track, dagre within each cluster |

**Color Modes:**

| Mode           | Key            | Description                                                       |
| -------------- | -------------- | ----------------------------------------------------------------- |
| Node Type      | `type`         | Standard node type colors (assertion=blue, counter=red, etc.)     |
| Argument State | `state`        | Colors by lifecycle state (unchallenged, engaged, conceded, etc.) |
| Age            | `age`          | HSL gradient — newer arguments are greener/brighter               |
| Connectivity   | `connectivity` | Brightness scales with node degree (more connections = brighter)  |

**Features:**

- Search bar to find nodes by content
- Legend showing current color mapping
- Minimap for navigation
- Collapsible analytics sidebar (`MapAnalytics`)
- Node detail panel on click
- Zoom controls

#### `MapAnalytics`

Analytics sidebar displayed inside `ArgumentMapExpanded`. Computes and displays:

| Section              | Content                                                  |
| -------------------- | -------------------------------------------------------- |
| **Overview**         | Total arguments, total connections, sourced %, max depth |
| **By Node Type**     | Distribution bar chart of all 8 node types               |
| **By State**         | Distribution bar chart of all 7 states                   |
| **By Edge Type**     | Distribution of relationship types                       |
| **By Track**         | Node counts per discourse track                          |
| **Contention Ratio** | Challenge+contradict count vs. support+synthesize count  |
| **Average Depth**    | Mean depth of argument chains                            |
| **Most Connected**   | Top 5 highest-degree nodes (clickable to highlight)      |

**Props:**

| Prop              | Type                       | Description                   |
| ----------------- | -------------------------- | ----------------------------- |
| `nodes`           | `GraphNode[]`              | All graph nodes               |
| `edges`           | `GraphEdge[]`              | All graph edges               |
| `onHighlightNode` | `(nodeId: string) => void` | Highlight a node in the graph |

### AI Feature Components

#### `BriefingRoom`

Displays the AI-generated briefing for a debate. Sections:

- Summary
- Key positions with strength ratings
- Track summaries
- Discourse health metrics
- Contention areas
- AI-powered vs. computed badge

Collapsible in the right sidebar.

#### `RAGQueryPanel`

"Ask the Debate" interface in the right sidebar. Features:

- Text input for questions
- 5 suggested query buttons:
  1. "What are the main points of agreement?"
  2. "What evidence has been cited?"
  3. "What arguments remain unchallenged?"
  4. "Where do the key disagreements lie?"
  5. "What has been conceded so far?"
- Loading state with message: "Searching vectors & traversing argument graph..."
- Query history with expandable results
- Retrieval stats display (vector count, graph expansion, merged context)
- AI/non-AI badge
- Clear history button

**Props:**

| Prop      | Type     | Description    |
| --------- | -------- | -------------- |
| `topicId` | `string` | Topic to query |

#### `CatchUpModal`

Fullscreen modal for newcomer catch-up briefing. Sections:

- **Header** — "Catch Up on This Debate" with argument/participant counts
- **Summary** — AI-generated overview
- **Established** — Widely accepted points (green cards with claim + basis)
- **Refuted** — Successfully challenged points (red cards with strikethrough + rebuttal)
- **Still Contested** — Active discussions (amber cards with topic + sides)
- **Where You Can Contribute** — Actionable opportunities with type badges (gap / unchallenged_claim / unanswered_question) and "Respond" buttons
- **Footer** — participant count + "Dive In" button

**Props:**

| Prop                   | Type                   | Description                     |
| ---------------------- | ---------------------- | ------------------------------- |
| `catchUp`              | `CatchUpData`          | Catch-up briefing data          |
| `onClose`              | `() => void`           | Close modal                     |
| `onNavigateToArgument` | `(id: string) => void` | Navigate to a specific argument |

#### `DuplicateCheckModal`

Modal showing duplicate detection results before argument submission.

- **Warning state** (duplicate found): amber header, similarity %, similar arguments list, AI suggestion for differentiation
- **Success state** (original): green header, confirmation to proceed
- Confidence bar (0-100%)
- "View" button for each similar argument
- Actions: "Edit my argument" (cancel) or "Submit anyway" (proceed)

**Props:**

| Prop            | Type                   | Description                  |
| --------------- | ---------------------- | ---------------------------- |
| `result`        | `DuplicateCheckResult` | Duplicate check results      |
| `onProceed`     | `() => void`           | Submit anyway                |
| `onCancel`      | `() => void`           | Go back and edit             |
| `onViewSimilar` | `(id: string) => void` | Navigate to similar argument |

#### `DebateSuggestions`

Web-search-powered topic suggestions, displayed as the right column on the Home page.

- Category filter tabs: All, Geopolitical, Tech, Economic, Social, Environ.
- Custom search input
- Refresh button with spin animation
- Scrollable suggestion cards with:
  - Timeliness badge (breaking / recent / ongoing)
  - AI-framed badge
  - Tags, source link
  - "Create" button → creates topic and navigates to it
- Live indicator when search is available

#### `NewsTicker`

Auto-scrolling horizontal news ticker displayed at the top of the Home page.

- Fetches from `GET /api/news` (25 articles, 3-min stale time, 5-min auto-refresh)
- Cards show: category badge, source, title, body preview
- **"Debate This"** button creates a topic from the article
- Infinite scroll (duplicated content for seamless loop)
- Pause on hover, play/pause button, manual scroll arrows
- Category color coding: geopolitical=sky, technology=orange, economic=emerald, social=violet, environment=teal

#### `HomeRAGQuery`

Graph RAG query panel on the Home page, allowing users to query any debate.

- Topic dropdown selector (loads all topics)
- Query text input with search icon
- "Ask" button triggers `ragQuery()` mutation
- Result display: AI answer, retrieval stats (vector count, graph count, merged), clear button
- Error state for missing vector backfill
- Loading state with "Searching vectors & traversing argument graph..."

### Utility Components

#### `NodeTypeBadge`

Colored pill displaying the argument node type. Colors:

- Assertion: blue
- Counter: red
- Qualification: amber
- Exception: orange
- Synthesis: purple
- Reframe: teal
- Open Question: yellow
- Concession: green

#### `StateBadge`

Indicator showing the argument's lifecycle state with appropriate color and icon.

---

## State Management

### Data Fetching (TanStack React Query)

All server state is managed via React Query. Key query keys:

| Query Key                 | Endpoint                          | Used In                            |
| ------------------------- | --------------------------------- | ---------------------------------- |
| `['topics']`              | `GET /topics`                     | Home                               |
| `['topic', id]`           | `GET /topics/:id`                 | TopicDetail                        |
| `['arguments', topicId]`  | `GET /topics/:id/arguments`       | TopicDetail                        |
| `['graph', topicId]`      | `GET /topics/:id/arguments/graph` | ArgumentGraph, ArgumentMapExpanded |
| `['tracks', topicId]`     | `GET /topics/:id/tracks`          | TopicDetail sidebar                |
| `['briefing', topicId]`   | `GET /topics/:id/briefing`        | BriefingRoom                       |
| `['suggestions', params]` | `GET /suggestions`                | DebateSuggestions                  |
| `['news-feed']`           | `GET /news`                       | NewsTicker                         |
| `['topics-for-rag']`      | `GET /topics`                     | HomeRAGQuery                       |

**Mutations** invalidate related queries on success:

- `submitArgument` → invalidates `arguments`, `graph`, `tracks`
- `transitionState` → invalidates `arguments`, `graph`
- `createTopic` → invalidates `topics`
- `deleteTopic` → invalidates `topics`

### Auth State (`useAuth` hook)

Client-side auth state using React `useState` + `localStorage`:

```typescript
const { user, token, login, register, logout, loading } = useAuth()
```

- `token` stored in `localStorage` as `crux_token`
- Axios interceptor auto-attaches `Authorization: Bearer <token>` header
- `loading` state prevents flash of login page on refresh
- `user` fetched via `GET /users/me` on mount if token exists

---

## API Client (`api/client.ts`)

Axios instance with base URL `/api` (proxied by Vite to `:8000` in development).

**26 API functions:**

| Function                  | Method | Path                                       |
| ------------------------- | ------ | ------------------------------------------ |
| `registerUser`            | POST   | `/users/register`                          |
| `loginUser`               | POST   | `/users/login`                             |
| `getMe`                   | GET    | `/users/me`                                |
| `getTopics`               | GET    | `/topics`                                  |
| `getTopic`                | GET    | `/topics/:id`                              |
| `createTopic`             | POST   | `/topics`                                  |
| `updateTopic`             | PATCH  | `/topics/:id`                              |
| `deleteTopic`             | DELETE | `/topics/:id`                              |
| `archiveTopic`            | POST   | `/topics/:id/archive`                      |
| `getTracks`               | GET    | `/topics/:id/tracks`                       |
| `createTrack`             | POST   | `/topics/:id/tracks`                       |
| `getArguments`            | GET    | `/topics/:id/arguments`                    |
| `submitArgument`          | POST   | `/topics/:id/arguments`                    |
| `updateArgument`          | PATCH  | `/topics/:id/arguments/:argId`             |
| `deleteArgument`          | DELETE | `/topics/:id/arguments/:argId`             |
| `transitionArgumentState` | POST   | `/topics/:id/arguments/:argId/transition`  |
| `getAvailableTransitions` | GET    | `/topics/:id/arguments/:argId/transitions` |
| `getGraph`                | GET    | `/topics/:id/arguments/graph`              |
| `getBriefing`             | GET    | `/topics/:id/briefing`                     |
| `getCatchUp`              | GET    | `/topics/:id/catch-up`                     |
| `getDebateSuggestions`    | GET    | `/suggestions`                             |
| `getNewsFeed`             | GET    | `/news`                                    |
| `checkDuplicate`          | POST   | `/topics/:id/arguments/check-duplicate`    |
| `ragQuery`                | POST   | `/topics/:id/arguments/rag-query`          |
| `backfillVectors`         | POST   | `/topics/:id/arguments/backfill-vectors`   |

---

## TypeScript Types (`types/index.ts`)

Key interfaces mirroring backend schemas:

| Type                      | Description                                                           |
| ------------------------- | --------------------------------------------------------------------- |
| `User`                    | User profile with credibility, expert info                            |
| `Topic`                   | Debate topic with tags, status, counts                                |
| `DiscourseTrack`          | Sub-theme with node count                                             |
| `ArgumentNode`            | Full argument with author, AI metadata, children count                |
| `GraphNode`               | Argument formatted for graph visualization                            |
| `GraphEdge`               | Edge formatted for graph visualization                                |
| `GraphData`               | `{ nodes: GraphNode[], edges: GraphEdge[] }`                          |
| `BriefingData`            | AI briefing with positions, health, tracks                            |
| `CatchUpData`             | Newcomer briefing with established/refuted/active/opportunities       |
| `ContributionOpportunity` | Where a newcomer can contribute (gap/unchallenged/unanswered)         |
| `DebateSuggestion`        | Web search suggestion with timeliness, tags, source                   |
| `NewsArticle`             | News article for ticker with title, body, url, source, date, category |
| `DuplicateCheckResult`    | Duplicate detection result with confidence, similar args              |
| `RAGQueryResult`          | RAG Q&A response with answer, context count, retrieval stats          |

---

## Routing

React Router v6 routes:

| Path             | Page                  | Auth Required |
| ---------------- | --------------------- | ------------- |
| `/auth`          | Auth (login/register) | No            |
| `/`              | Home (topic list)     | Yes           |
| `/topics/create` | CreateTopic           | Yes           |
| `/topics/:id`    | TopicDetail           | Yes           |

The `App.tsx` component wraps all authenticated routes in an auth gate that redirects to `/auth` if no token is present.
