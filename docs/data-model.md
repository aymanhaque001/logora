# Data Model

> Database tables, enums, relationships, and state machine documentation.

Logora uses **SQLAlchemy 2.0** with SQLite. All models are in `backend/app/models.py`.

---

## Entity Relationship Diagram

```
┌──────────┐       ┌────────────────┐       ┌───────────────────┐
│  users   │──┐    │    topics      │──┐    │ discourse_tracks  │
│          │  │    │                │  │    │                   │
│ id (PK)  │  │    │ id (PK)       │  │    │ id (PK)          │
│ email    │  │    │ canonical_q   │  │    │ topic_id (FK)    │
│ username │  │    │ description   │  │    │ name              │
│ display  │  │    │ tags (JSON)   │  │    │ description       │
│ password │  │    │ location      │  │    │ auto_detected     │
│ cred.    │  │    │ status        │  │    │ created_at        │
│ expert?  │  │    │ created_by(FK)│──┘    └─────────┬─────────┘
│ domain   │  │    │ created_at    │                  │
│ created  │  │    │ updated_at    │                  │
└──────────┘  │    └───────┬───────┘                  │
              │            │                          │
              │            │ 1:N                      │ 1:N
              │            ▼                          │
              │    ┌───────────────────┐              │
              │    │ argument_nodes    │──────────────┘
              └───▶│                   │
                   │ id (PK)          │     ┌───────────────────┐
                   │ topic_id (FK)    │     │  argument_edges   │
                   │ track_id (FK)    │     │                   │
                   │ parent_id (FK)───│──┐  │  id (PK)          │
                   │ author_id (FK)   │  │  │  source_id (FK)   │
                   │ content          │  │  │  target_id (FK)   │
                   │ node_type        │  └──│  relationship     │
                   │ nuance_tags(JSON)│     │  created_at       │
                   │ sources (JSON)   │     └───────────────────┘
                   │ state            │
                   │ ai_confidence    │
                   │ ai_track         │
                   │ ai_summary       │
                   │ created_at       │
                   │ updated_at       │
                   └──────────────────┘
```

---

## Enums

### TopicTag

Tags for categorizing debate topics.

| Value           | Description                          |
| --------------- | ------------------------------------ |
| `geographic`    | Location-specific issues             |
| `social`        | Social policy and society            |
| `economic`      | Economics, trade, markets            |
| `scientific`    | Science, technology, methodology     |
| `political`     | Governance, policy, diplomacy        |
| `environmental` | Climate, environment, sustainability |

Stored as a JSON array on the `topics` table. Topics can have multiple tags.

### NodeType

Semantic type of an argument node. Determines how it relates to the debate structure.

| Value           | Description                                  | Color (UI)  |
| --------------- | -------------------------------------------- | ----------- |
| `assertion`     | A claim or position statement                | Blue        |
| `counter`       | Directly challenges another argument         | Red         |
| `qualification` | Adds nuance or conditions                    | Amber       |
| `exception`     | Edge cases where an argument doesn't hold    | Orange      |
| `synthesis`     | Combines multiple arguments                  | Purple      |
| `reframe`       | Recontextualizes from a different angle       | Teal        |
| `open_question` | An unanswered question for the community     | Yellow      |
| `concession`    | Acknowledges validity of an opposing point   | Green       |

### ArgumentState

Lifecycle state of an argument. See [State Machine](#state-machine) below.

| Value          | Terminal? | Description                              |
| -------------- | :-------: | ---------------------------------------- |
| `unchallenged` |    No     | No responses yet                         |
| `engaged`      |    No     | Has at least one response                |
| `refined`      |    No     | Author edited after receiving responses  |
| `branched`     |    No     | 3+ children from 2+ distinct authors     |
| `merged`       |   Yes     | Sub-arguments consolidated               |
| `conceded`     |   Yes     | Author acknowledged being wrong          |
| `dormant`      |    No     | No activity for 30 days                  |

### EdgeRelationship

Type of relationship between two connected arguments.

| Value          | Description                              | Direction           |
| -------------- | ---------------------------------------- | ------------------- |
| `supports`     | Provides evidence or backing             | source → target     |
| `challenges`   | Directly opposes or rebuts               | source → target     |
| `qualifies`    | Adds conditions or nuance               | source → target     |
| `refines`      | Improves or sharpens the argument        | source → target     |
| `contradicts`  | Logically incompatible                   | source ↔ target     |
| `synthesizes`  | Combines insights from target            | source → target     |
| `questions`    | Raises a question about the target       | source → target     |

### NuanceTag

Tags indicating the type of nuance an argument carries.

| Value                    | Description                              |
| ------------------------ | ---------------------------------------- |
| `temporal`               | Time-dependent claim                     |
| `geographic`             | Location-specific claim                  |
| `scale`                  | Scale-dependent (individual vs. systemic)|
| `conditional`            | Depends on specific conditions           |
| `population_specific`    | Applies to a specific demographic        |
| `contested_empirically`  | Empirical evidence is disputed           |

### TopicStatus

Lifecycle status of a debate topic.

| Value        | Description                                    |
| ------------ | ---------------------------------------------- |
| `active`     | Ongoing debate, accepting new arguments        |
| `cooling`    | No activity for 30 days, may become historical |
| `historical` | Archived, read-only                            |

---

## Tables

### users

User accounts with credibility tracking and expert verification.

| Column             | Type      | Constraints      | Default | Description                    |
| ------------------ | --------- | ---------------- | ------- | ------------------------------ |
| `id`               | String    | PK               | UUID    | Unique identifier              |
| `email`            | String    | unique, indexed  | —       | Login email                    |
| `username`         | String    | unique, indexed  | —       | Display username               |
| `display_name`     | String    | not null         | —       | Full name                      |
| `hashed_password`  | String    | not null         | —       | bcrypt hash                    |
| `credibility_score`| Float     | —                | 50.0    | [0, 100] credibility score     |
| `is_verified_expert`| Boolean  | —                | False   | Expert verification status     |
| `expert_domain`    | String    | nullable         | null    | Domain of expertise            |
| `created_at`       | DateTime  | —                | now()   | Account creation timestamp     |

### topics

Debate topics with metadata and lifecycle status.

| Column              | Type           | Constraints     | Default  | Description                |
| ------------------- | -------------- | --------------- | -------- | -------------------------- |
| `id`                | String         | PK              | UUID     | Unique identifier          |
| `canonical_question`| String         | not null        | —        | The debate question        |
| `description`       | Text           | nullable        | null     | Extended description       |
| `tags`              | JSON           | —               | []       | Array of TopicTag values   |
| `location`          | String         | nullable        | null     | Geographic scope           |
| `status`            | Enum(TopicStatus)| —             | `active` | Lifecycle status           |
| `created_by`        | String         | FK → users.id   | —        | Creator user ID            |
| `created_at`        | DateTime       | —               | now()    | Creation timestamp         |
| `updated_at`        | DateTime       | —               | now()    | Auto-updated on change     |

**Computed fields in API responses:**
- `node_count` — total argument nodes for this topic
- `track_count` — total discourse tracks for this topic

### discourse_tracks

Sub-themes within a debate. Can be auto-detected by AI or manually created.

| Column         | Type     | Constraints      | Default | Description                    |
| -------------- | -------- | ---------------- | ------- | ------------------------------ |
| `id`           | String   | PK               | UUID    | Unique identifier              |
| `topic_id`     | String   | FK → topics.id   | —       | Parent topic                   |
| `name`         | String   | not null         | —       | Track name                     |
| `description`  | Text     | nullable         | null    | Track description              |
| `auto_detected`| Boolean  | —                | False   | Whether AI created this track  |
| `created_at`   | DateTime | —                | now()   | Creation timestamp             |

**Computed fields in API responses:**
- `node_count` — total argument nodes in this track

### argument_nodes

Individual arguments in a debate graph. The core entity.

| Column                       | Type              | Constraints          | Default        | Description                        |
| ---------------------------- | ----------------- | -------------------- | -------------- | ---------------------------------- |
| `id`                         | String            | PK                   | UUID           | Unique identifier                  |
| `topic_id`                   | String            | FK → topics.id       | —              | Parent topic                       |
| `track_id`                   | String            | FK → discourse_tracks.id | nullable   | Discourse track (AI-assigned)      |
| `parent_id`                  | String            | FK → argument_nodes.id | nullable     | Parent argument (self-referential) |
| `author_id`                  | String            | FK → users.id        | —              | Author user ID                     |
| `content`                    | Text              | not null             | —              | Full argument text (min 20 chars)  |
| `node_type`                  | Enum(NodeType)    | not null             | —              | Semantic argument type             |
| `nuance_tags`                | JSON              | —                    | []             | Array of NuanceTag values          |
| `sources`                    | JSON              | —                    | []             | Array of source citation objects   |
| `state`                      | Enum(ArgumentState)| —                  | `unchallenged` | Lifecycle state                    |
| `ai_classification_confidence`| Float           | nullable             | null           | AI confidence in node_type (0-1)   |
| `ai_suggested_track`         | String            | nullable             | null           | AI-suggested track theme name      |
| `ai_summary`                 | Text              | nullable             | null           | AI-generated ≤12-word summary      |
| `created_at`                 | DateTime          | —                    | now()          | Creation timestamp                 |
| `updated_at`                 | DateTime          | —                    | now()          | Auto-updated on change             |

**Relationships:**
- `children` — one-to-many self-referential (other argument_nodes where `parent_id = this.id`)
- `author` — many-to-one to `users`

**Source object schema** (stored in JSON):

```json
{
  "url": "https://example.com/study",
  "title": "Smith et al. 2023",
  "description": "Longitudinal study of housing markets",
  "source_type": "academic"
}
```

### argument_edges

Typed relationships between argument nodes. Created when an argument replies to another.

| Column              | Type                  | Constraints             | Default | Description              |
| ------------------- | --------------------- | ----------------------- | ------- | ------------------------ |
| `id`                | String                | PK                      | UUID    | Unique identifier        |
| `source_id`         | String                | FK → argument_nodes.id  | —       | Source argument           |
| `target_id`         | String                | FK → argument_nodes.id  | —       | Target argument           |
| `relationship_type` | Enum(EdgeRelationship)| not null                | —       | Type of relationship     |
| `created_at`        | DateTime              | —                       | now()   | Creation timestamp       |

---

## State Machine

Arguments progress through lifecycle states based on user actions and system events.

### Transition Diagram

```
                    ┌─────────────┐
                    │ unchallenged │
                    └──────┬──────┘
                           │ first child submitted (auto)
                           ▼
                    ┌─────────────┐
              ┌────▶│   engaged   │◀───────────────────────┐
              │     └──┬──┬──┬───┘                         │
              │        │  │  │                              │
              │        │  │  │ 3+ children,                │
              │        │  │  │ 2+ authors (auto)           │
              │        │  │  ▼                              │
              │        │  │ ┌──────────┐     ┌──────────┐  │
              │        │  │ │ branched │────▶│  merged  │  │
              │        │  │ └──────────┘     └──────────┘  │
              │        │  │                   (terminal)    │
              │        │  │                                 │
              │        │  │ author concedes                │
              │        │  ▼                                 │
              │        │ ┌──────────┐                      │
              │        │ │ conceded │                      │
              │        │ └──────────┘                      │
              │        │  (terminal)                        │
              │        │                                    │
              │        │ author edits                       │
              │        ▼                                    │
              │  ┌──────────┐                              │
              │  │ refined  │──────────────────────────────┘
              │  └──────────┘     (re-engagement)
              │
              │  30 days no activity (system)
              │  ┌──────────┐
              └──│  dormant │
                 └──────────┘
                  any state can become dormant
```

### Transition Rules

| Current State  | New State    | Trigger                            | Actor   | Credibility Impact          |
| -------------- | ------------ | ---------------------------------- | ------- | --------------------------- |
| `unchallenged` | `engaged`    | First child argument submitted     | System  | +1.0 to parent's author     |
| `engaged`      | `branched`   | 3+ children from 2+ distinct users | System  | —                           |
| `engaged`      | `refined`    | Author edits their argument        | Author  | —                           |
| `engaged`      | `conceded`   | Author concedes the point          | Author  | +3.0 to author (honesty)    |
| `branched`     | `merged`     | Manual merge                       | Any     | —                           |
| `dormant`      | `engaged`    | New response submitted             | Any     | —                           |
| any            | `dormant`    | 30 days of inactivity              | System  | —                           |

### Getting Available Transitions

The `GET /api/topics/{id}/arguments/{arg_id}/transitions` endpoint returns which transitions the current user can perform, based on:
1. The argument's current state
2. Whether the user is the argument's author (required for `concede` and `refine`)

---

## Credibility Scoring

Credibility is a float in [0, 100] stored on the `users` table. It's updated by the `credibility.award()` function.

| Action Code     | Trigger                                  | Points |
| --------------- | ---------------------------------------- | :----: |
| `submit_sourced`| Submit argument with `sources.length > 0`| +2.0   |
| `submit_unsourced`| Submit argument without sources        | +0.5   |
| `engaged`       | Your argument receives a response        | +1.0   |
| `concede`       | You concede one of your arguments        | +3.0   |
| `conceded_to`   | Someone concedes to your argument        | +2.0   |

The score is clamped to [0, 100] after each update. Initial score for new users is 50.0.
