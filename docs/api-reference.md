# API Reference

> Complete endpoint reference for the Crux REST API.

Base URL: `http://localhost:8000/api`

Interactive Swagger docs: `http://localhost:8000/docs`

---

## Authentication

All authenticated endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are obtained via the login endpoint and contain the user ID. Tokens are signed with the `SECRET_KEY` environment variable using HS256.

---

## Users

### Register

```
POST /api/users/register
```

Create a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "username": "username",
  "display_name": "Display Name",
  "password": "password123"
}
```

**Response:** `200 OK`

```json
{
  "token": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "display_name": "Display Name",
    "credibility_score": 50.0,
    "is_verified_expert": false,
    "expert_domain": null,
    "created_at": "2025-01-01T00:00:00"
  }
}
```

### Login

```
POST /api/users/login
```

Authenticate and receive a JWT token.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK` — same as register response.

### Get Profile

```
GET /api/users/me
```

**Auth:** Required

**Response:** `200 OK` — `UserOut` object.

---

## Topics

### List Topics

```
GET /api/topics
```

**Query Parameters:**

| Param    | Type   | Default | Description                                         |
| -------- | ------ | ------- | --------------------------------------------------- |
| `tag`    | string | —       | Filter by topic tag (e.g., `economic`)              |
| `search` | string | —       | Search in canonical question and description        |
| `status` | string | —       | Filter by status: `active`, `cooling`, `historical` |

**Response:** `200 OK` — Array of `TopicOut` (max 50, sorted by newest).

```json
[
  {
    "id": "uuid",
    "canonical_question": "Is gentrification harmful?",
    "description": "...",
    "tags": ["geographic", "social", "economic"],
    "location": "United States",
    "status": "active",
    "created_by": "uuid",
    "created_at": "2025-01-01T00:00:00",
    "updated_at": "2025-01-01T00:00:00",
    "node_count": 16,
    "track_count": 3
  }
]
```

### Create Topic

```
POST /api/topics
```

**Auth:** Required

**Request Body:**

```json
{
  "canonical_question": "Should cities ban cars from city centers",
  "description": "Exploring the tradeoffs of car-free urban zones.",
  "tags": ["geographic", "environmental"],
  "location": "Europe"
}
```

> Note: A `?` is automatically appended to the canonical question if missing.

**Response:** `200 OK` — `TopicOut` object.

### Get Topic

```
GET /api/topics/{topic_id}
```

**Response:** `200 OK` — `TopicOut` object (enriched with `node_count`, `track_count`).

### Update Topic

```
PATCH /api/topics/{topic_id}
```

**Auth:** Required (creator only). Blocked if topic is archived (`historical`).

**Request Body:** (all fields optional)

```json
{
  "canonical_question": "Updated question?",
  "description": "Updated description.",
  "tags": ["economic"]
}
```

**Response:** `200 OK` — updated `TopicOut`.

### Delete Topic

```
DELETE /api/topics/{topic_id}
```

**Auth:** Required (creator only). Blocked if topic has any arguments.

**Response:** `200 OK` — `{"status": "deleted"}`

### Archive Topic

```
POST /api/topics/{topic_id}/archive
```

**Auth:** Required (creator only). Sets status to `historical`.

**Response:** `200 OK` — updated `TopicOut`.

### Lifecycle Check

```
POST /api/topics/lifecycle/check
```

Transitions `active` topics with no activity in 30 days to `cooling` status.

**Response:** `200 OK`

```json
{
  "checked": 10,
  "transitioned": 2
}
```

---

## Discourse Tracks

### List Tracks

```
GET /api/topics/{topic_id}/tracks
```

**Response:** `200 OK`

```json
[
  {
    "id": "uuid",
    "topic_id": "uuid",
    "name": "Economic Effects",
    "description": "Arguments about economic impact...",
    "auto_detected": true,
    "created_at": "2025-01-01T00:00:00",
    "node_count": 6
  }
]
```

### Create Track

```
POST /api/topics/{topic_id}/tracks
```

**Auth:** Required

**Request Body:**

```json
{
  "name": "Environmental Impact",
  "description": "Arguments about environmental consequences."
}
```

**Response:** `200 OK` — `TrackOut` object.

---

## Briefing

### Get Briefing

```
GET /api/topics/{topic_id}/briefing
```

AI-generated neutral analysis of the debate. Falls back to computed statistics without AI.

**Response:** `200 OK`

```json
{
  "summary": "This debate examines whether...",
  "key_positions": [
    {
      "position": "Gentrification displaces residents",
      "strength": "strong",
      "supporting_count": 4
    }
  ],
  "track_summaries": [
    {
      "track_name": "Economic Effects",
      "summary": "Focused on displacement costs vs. investment..."
    }
  ],
  "discourse_health": {
    "engagement_quality": "high",
    "nuance_level": "moderate",
    "echo_chamber_risk": "low"
  },
  "contention_areas": ["Effect of rent control policies"]
}
```

### Get Catch-Up

```
GET /api/topics/{topic_id}/catch-up
```

**Auth:** Optional (personalized by expertise domain if authenticated).

AI-generated newcomer briefing with established points, refuted points, active debates, and contribution opportunities.

**Response:** `200 OK`

```json
{
  "is_newcomer": true,
  "established_points": [
    {
      "claim": "Displacement occurs in gentrifying areas",
      "basis": "Multiple studies cited..."
    }
  ],
  "refuted_points": [
    {
      "claim": "All residents benefit equally",
      "rebuttal": "Counter-evidence shows..."
    }
  ],
  "active_debates": [
    {
      "topic": "Effectiveness of rent control",
      "sides": ["Prevents displacement", "Reduces housing supply"]
    }
  ],
  "contribution_opportunities": [
    {
      "argument_id": "uuid",
      "content_snippet": "This claim about property taxes...",
      "opportunity_type": "unchallenged_claim",
      "suggestion": "Consider whether this applies outside US markets."
    }
  ],
  "summary": "This debate has 16 arguments from 5 participants...",
  "total_nodes": 16,
  "total_participants": 5,
  "ai_powered": true
}
```

---

## Arguments

### List Arguments

```
GET /api/topics/{topic_id}/arguments
```

**Query Parameters:**

| Param      | Type   | Description               |
| ---------- | ------ | ------------------------- |
| `track_id` | string | Filter by discourse track |

**Response:** `200 OK` — Array of `ArgumentNodeOut` (sorted by creation date).

```json
[
  {
    "id": "uuid",
    "topic_id": "uuid",
    "track_id": "uuid",
    "parent_id": null,
    "author_id": "uuid",
    "content": "The evidence suggests that...",
    "node_type": "assertion",
    "nuance_tags": ["temporal", "geographic"],
    "sources": [
      {
        "url": "https://example.com/study",
        "title": "Smith et al. 2023",
        "description": "Longitudinal study of housing markets",
        "source_type": "academic"
      }
    ],
    "state": "engaged",
    "ai_classification_confidence": 0.92,
    "ai_suggested_track": "Economic Effects",
    "ai_summary": "Evidence points to displacement in gentrifying areas",
    "created_at": "2025-01-01T00:00:00",
    "updated_at": "2025-01-01T00:00:00",
    "author": {
      "id": "uuid",
      "username": "sarah_chen",
      "display_name": "Sarah Chen",
      "credibility_score": 82.0
    },
    "children_count": 3
  }
]
```

### Submit Argument

```
POST /api/topics/{topic_id}/arguments
```

**Auth:** Required

**Request Body:**

```json
{
  "content": "The evidence from a longitudinal study...",
  "node_type": "assertion",
  "parent_id": null,
  "edge_relationship": null,
  "nuance_tags": ["temporal"],
  "sources": [
    {
      "url": "https://example.com",
      "title": "Study Title",
      "description": "Description",
      "source_type": "academic"
    }
  ]
}
```

| Field               | Required | Notes                            |
| ------------------- | -------- | -------------------------------- |
| `content`           | Yes      | Minimum 20 characters            |
| `node_type`         | Yes      | One of the 8 node types          |
| `parent_id`         | No       | ID of parent argument (replies)  |
| `edge_relationship` | No       | Required if `parent_id` is set   |
| `nuance_tags`       | No       | Array of nuance tag values       |
| `sources`           | No       | Array of source citation objects |

**Side Effects:**

- AI classifies node type (may override user selection) and assigns to a track
- AI generates a summary for graph display
- Parent argument auto-transitions (`unchallenged` → `engaged`; `engaged` → `branched` if 3+ children from 2+ authors)
- Credibility awarded (+2.0 with sources, +0.5 without; +1.0 to parent's author for engagement)
- Argument indexed in ChromaDB vector store

**Response:** `200 OK` — `ArgumentNodeOut` object.

### Get Graph

```
GET /api/topics/{topic_id}/arguments/graph
```

Returns all arguments and edges formatted for ReactFlow visualization.

**Response:** `200 OK`

```json
{
  "nodes": [
    {
      "id": "uuid",
      "content": "The evidence suggests...",
      "node_type": "assertion",
      "state": "engaged",
      "author_username": "sarah_chen",
      "author_display_name": "Sarah Chen",
      "author_credibility": 82.0,
      "ai_summary": "Evidence points to displacement",
      "track_id": "uuid",
      "track_name": "Economic Effects",
      "sources_count": 2,
      "children_count": 3,
      "created_at": "2025-01-01T00:00:00"
    }
  ],
  "edges": [
    {
      "id": "uuid",
      "source_id": "uuid",
      "target_id": "uuid",
      "relationship_type": "challenges"
    }
  ]
}
```

### Update Argument

```
PATCH /api/topics/{topic_id}/arguments/{argument_id}
```

**Auth:** Required (author only).

**Request Body:** (all fields optional)

```json
{
  "content": "Updated argument text...",
  "nuance_tags": ["temporal", "scale"],
  "sources": [...]
}
```

Auto-transitions to `refined` state if the argument is currently `engaged`.

**Response:** `200 OK` — updated `ArgumentNodeOut`.

### Delete Argument

```
DELETE /api/topics/{topic_id}/arguments/{argument_id}
```

**Auth:** Required (author only). Blocked if argument has children (must delete children first).

**Response:** `200 OK` — `{"status": "deleted"}`

### Transition State

```
POST /api/topics/{topic_id}/arguments/{argument_id}/transition
```

**Auth:** Required. Some transitions are author-only (`concede`, `refine`).

**Request Body:**

```json
{
  "new_state": "conceded",
  "reason": "The counter-evidence is convincing."
}
```

**State Transition Rules:**

| From         | To       | Who    | Notes                        |
| ------------ | -------- | ------ | ---------------------------- |
| unchallenged | engaged  | Auto   | On first child submission    |
| engaged      | refined  | Author | On edit with responses       |
| engaged      | branched | Auto   | 3+ children from 2+ authors  |
| engaged      | conceded | Author | +3.0 credibility for honesty |
| branched     | merged   | Any    | Terminal state               |
| dormant      | engaged  | Any    | Re-engagement                |
| any          | dormant  | System | 30 days no activity          |

**Response:** `200 OK` — updated `ArgumentNodeOut`.

### Get Available Transitions

```
GET /api/topics/{topic_id}/arguments/{argument_id}/transitions
```

**Auth:** Required

**Response:** `200 OK`

```json
{
  "available_transitions": ["conceded", "refined"]
}
```

### Mark Dormant

```
POST /api/topics/{topic_id}/arguments/lifecycle/dormant
```

Marks all arguments with no activity in 30 days as `dormant`.

**Response:** `200 OK`

```json
{
  "checked": 16,
  "transitioned": 2
}
```

---

## Duplicate Detection (Graph RAG)

### Check Duplicate

```
POST /api/topics/{topic_id}/arguments/check-duplicate
```

Checks whether proposed content duplicates an existing argument using vector search + graph expansion + Claude reasoning.

**Request Body:**

```json
{
  "content": "Gentrification leads to displacement of low-income residents..."
}
```

**Response:** `200 OK`

```json
{
  "is_duplicate": true,
  "confidence": 0.87,
  "similar_arguments": [
    {
      "id": "uuid",
      "content_preview": "Studies show gentrification displaces...",
      "similarity": 0.91
    }
  ],
  "explanation": "Your argument closely mirrors an existing assertion about displacement...",
  "suggestion": "Consider focusing on a specific geographic area or adding new evidence.",
  "ai_powered": true
}
```

**Thresholds:**

- Similarity ≥ 0.75 → triggers Claude duplicate analysis
- Without AI: similarity > 0.85 → marked as duplicate (stub fallback)

---

## RAG Query

### Ask the Debate

```
POST /api/topics/{topic_id}/arguments/rag-query
```

Ask analytical questions about a debate. Uses hybrid Graph RAG (vector search + graph expansion + Claude analysis).

**Request Body:**

```json
{
  "query": "What evidence has been cited about displacement?"
}
```

**Response:** `200 OK`

```json
{
  "answer": "Several arguments cite evidence about displacement...",
  "context_used": 12,
  "retrieval_stats": {
    "vector_count": 8,
    "graph_count": 15,
    "merged_count": 12,
    "unique_from_graph": 4
  },
  "ai_powered": true
}
```

**Pipeline parameters:**

- Vector search: top 10 results
- Graph expansion: 2 hops, max 30 nodes
- Context cap: 30 arguments × 400 characters each

### Backfill Vectors

```
POST /api/topics/{topic_id}/arguments/backfill-vectors
```

Index all existing arguments for a topic into the ChromaDB vector store. Useful after seeding data or if the vector store was reset.

**Response:** `200 OK`

```json
{
  "status": "backfill complete",
  "indexed": 75,
  "topic_id": "uuid"
}
```

---

## Web Search Suggestions

### Get Suggestions

```
GET /api/suggestions
```

Search recent news and suggest debate topics framed by Claude.

**Query Parameters:**

| Param      | Type   | Default | Description                                                       |
| ---------- | ------ | ------- | ----------------------------------------------------------------- |
| `category` | string | —       | `geopolitical`, `technology`, `economic`, `social`, `environment` |
| `q`        | string | —       | Custom search query (overrides category)                          |
| `limit`    | int    | 5       | Number of suggestions (1-10)                                      |

**Response:** `200 OK`

```json
[
  {
    "canonical_question": "Should the EU impose tariffs on Chinese EVs?",
    "description": "Recent EU decisions on tariffs raise questions...",
    "tags": ["economic", "political"],
    "location": "European Union",
    "source_article": "EU Votes on EV Tariffs",
    "source_url": "https://...",
    "timeliness": "breaking",
    "ai_framed": true
  }
]
```

**Timeliness values:** `breaking`, `recent`, `ongoing`

---

## News Feed

### Get News Feed

```
GET /api/news
```

Fetch raw news headlines from DuckDuckGo for the live news ticker on the home page. Unlike debate suggestions, these are returned without AI framing for fast loading.

**Query Parameters:**

| Param      | Type   | Default | Description                                                       |
| ---------- | ------ | ------- | ----------------------------------------------------------------- |
| `category` | string | —       | `geopolitical`, `technology`, `economic`, `social`, `environment` |
| `limit`    | int    | 20      | Number of articles (1-50)                                         |

**Response:** `200 OK`

```json
{
  "articles": [
    {
      "title": "Global leaders meet to discuss AI governance frameworks",
      "body": "World leaders are convening to establish international guidelines...",
      "url": "https://...",
      "source": "Reuters",
      "date": "2026-02-28T08:25:00+00:00",
      "category": "technology"
    }
  ],
  "count": 20,
  "status": {
    "news_available": true
  }
}
```

**Categories:** Articles are labeled with the category of the query used to find them. When no category is specified, articles are drawn from all 5 categories.

**Deduplication:** Articles with identical titles (by MD5 hash) are automatically deduplicated.

**Fallback:** When DuckDuckGo is unavailable, returns 4 hardcoded placeholder headlines.

---

## Health

### Health Check

```
GET /api/health
```

**Response:** `200 OK`

```json
{
  "status": "healthy",
  "version": "0.2.0",
  "ai": {
    "ai_enabled": true,
    "model": "claude-sonnet-4-6",
    "init_error": null
  },
  "vector_store": {
    "available": true,
    "collection_count": 75,
    "model": "all-MiniLM-L6-v2",
    "init_error": null
  },
  "web_search": {
    "search_available": true,
    "ai_framing_available": true
  }
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

Common HTTP status codes:

| Code | Description                                             |
| ---- | ------------------------------------------------------- |
| 400  | Bad request (validation error, business rule violation) |
| 401  | Unauthorized (missing or invalid token)                 |
| 403  | Forbidden (not the owner/author)                        |
| 404  | Resource not found                                      |
| 422  | Validation error (Pydantic)                             |
| 500  | Internal server error                                   |
