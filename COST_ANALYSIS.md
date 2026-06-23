# Crux — Cost Analysis per 100 Users/Month

> Generated March 3, 2026. Model: `claude-sonnet-4-6`. Pricing: **$3/M input tokens, $15/M output tokens**.

---

## Claude API Calls Inventory

Every Claude call uses `claude-sonnet-4-6` with `max_tokens=1500`.

### Per-Take Submission (3 calls each)

| Call                    | Trigger                                | Est. Input | Est. Output |
| ----------------------- | -------------------------------------- | ---------- | ----------- |
| `classify_node`         | Every submission + pre-classify drafts | ~400 tok   | ~80 tok     |
| `detect_track_for_node` | Every submission (if tracks exist)     | ~215 tok   | ~25 tok     |
| `summarize_node`        | Every submission                       | ~175 tok   | ~25 tok     |

### Per-Topic View (cached, 10-min TTL)

| Call                        | Trigger                                  | Est. Input | Est. Output |
| --------------------------- | ---------------------------------------- | ---------- | ----------- |
| `generate_briefing`         | Topic page load (cache miss)             | ~2,040 tok | ~400 tok    |
| `summarize_track_evolution` | Current Web view, per track (cache miss) | ~670 tok   | ~35 tok     |

### On-Demand Features

| Call                          | Trigger                      | Est. Input | Est. Output |
| ----------------------------- | ---------------------------- | ---------- | ----------- |
| `discover_currents`           | Re-cluster button            | ~3,580 tok | ~400 tok    |
| `generate_catch_up`           | Catch-up briefing            | ~2,040 tok | ~400 tok    |
| `check_duplicate` (graph_rag) | Pre-submit duplicate check   | ~1,140 tok | ~80 tok     |
| `rag_briefing` (graph_rag)    | RAG Q&A query                | ~1,790 tok | ~250 tok    |
| `_frame_as_debates`           | Web search topic suggestions | ~1,330 tok | ~400 tok    |
| `batch_summarize_nodes`       | Topic seeding                | ~2,455 tok | ~350 tok    |

---

## Usage Model (100 Users)

| User Type | Count | Sessions/mo | Takes/mo | Topic Views/session |
| --------- | ----- | ----------- | -------- | ------------------- |
| Active    | 15    | 15          | 8        | 5                   |
| Moderate  | 35    | 8           | 3        | 3                   |
| Casual    | 50    | 3           | 1        | 2                   |

**Aggregate monthly activity:**

- **275 takes** submitted
- **~415 classify calls** (275 submissions + ~140 pre-classify drafts)
- **~400 duplicate checks** (pre-submit)
- **~2,265 topic page views** → ~500 briefing cache misses, ~400 evolution cache misses
- **~50 catch-up requests**, **~40 RAG queries**, **~30 re-clusters**, **~20 web searches**

---

## Monthly Token Consumption

| Call               | Freq. | Input Tokens  | Output Tokens |
| ------------------ | ----- | ------------- | ------------- |
| classify_node      | 415   | 166,000       | 33,200        |
| detect_track       | 275   | 59,125        | 6,875         |
| summarize_node     | 275   | 48,125        | 6,875         |
| generate_briefing  | 500   | 1,020,000     | 200,000       |
| track_evolution    | 400   | 268,000       | 14,000        |
| generate_catch_up  | 50    | 102,000       | 20,000        |
| discover_currents  | 30    | 107,400       | 12,000        |
| duplicate_check    | 400   | 456,000       | 32,000        |
| rag_briefing       | 40    | 71,600        | 10,000        |
| web_search framing | 20    | 26,600        | 8,000         |
| batch_summarize    | 10    | 24,550        | 3,500         |
| **TOTAL**          |       | **2,349,400** | **346,450**   |

---

## Monthly Cost Breakdown

| Item                                | Cost       |
| ----------------------------------- | ---------- |
| Claude input (2.35M tokens × $3/M)  | **$7.05**  |
| Claude output (346K tokens × $15/M) | **$5.20**  |
| **Claude API subtotal**             | **$12.25** |
| VPS hosting (2–4 GB droplet)        | $12 – $24  |
| Domain name                         | ~$1        |
| SQLite / ChromaDB / DuckDuckGo      | Free       |
| SSL (Let's Encrypt)                 | Free       |

| Scenario                      | Total/Month | Per User |
| ----------------------------- | ----------- | -------- |
| **Low** (basic $12 VPS)       | **~$25**    | $0.25    |
| **Mid** (decent $24 VPS)      | **~$37**    | $0.37    |
| **Heavy usage** (2× AI calls) | **~$50**    | $0.50    |

---

## Key Observations

1. **Briefing generation dominates** — 43% of input tokens. The 10-min cache saves ~75% of potential calls. Increasing TTL to 30 min would cut Claude costs by ~25%.

2. **Duplicate checks are the second biggest cost driver** at ~19% of input tokens. These could be skipped for topics with few arguments (< 5).

3. **Output tokens are cheap** relative to input because most responses are compact JSON. The `max_tokens=1500` cap is well-set.

4. **Scaling is roughly linear** — 1,000 users would cost ~$120–$150/month in Claude API, plus a beefier server ($48–$96).

5. **The biggest cost-saving lever is caching.** A Redis cache with 30-min TTL on briefings + evolution summaries would roughly halve the Claude bill.
