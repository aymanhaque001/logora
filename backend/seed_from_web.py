"""
seed_from_web.py — Seeds Crux with real debates from Reddit r/changemyview.

Uses:
  - Reddit public JSON API (no auth required)
  - Claude to classify each argument into Crux node types

Usage (from backend/ with venv active):
  python seed_from_web.py              # seeds 5 threads (default)
  python seed_from_web.py --limit 10   # seeds 10 threads
  python seed_from_web.py --clear      # wipes existing data first
  python seed_from_web.py --no-ai      # skips Claude classification (fast, basic)
"""

import sys
import os
import json
import time
import argparse
import random
import re

import requests

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base
from app.models import (
    User, Topic, DiscourseTrack, ArgumentNode, ArgumentEdge,
    NodeType, NuanceTag, ArgumentState, EdgeRelationship,
    TopicStatus, TopicTag,
)
from app.config import settings
import bcrypt as _bcrypt

# ─────────────────────────────────────────────────────────────────────────────
# CLI args
# ─────────────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Seed Crux from Reddit CMV")
parser.add_argument("--limit", type=int, default=5, help="Number of CMV threads to import")
parser.add_argument("--clear", action="store_true", help="Clear all existing data first")
parser.add_argument("--no-ai", action="store_true", help="Skip Claude classification")
parser.add_argument("--timeframe", default="month", choices=["day", "week", "month", "year", "all"],
                    help="Reddit top posts timeframe")
parser.add_argument("--comments-per-thread", type=int, default=12,
                    help="Max top-level comments to import per thread")
args = parser.parse_args()

USE_AI = not args.no_ai

# ─────────────────────────────────────────────────────────────────────────────
# AI client (optional)
# ─────────────────────────────────────────────────────────────────────────────

_ai_client = None
if USE_AI:
    try:
        import anthropic
        if settings.ANTHROPIC_API_KEY:
            _ai_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            print("[AI] Claude ready.")
        else:
            print("[AI] No ANTHROPIC_API_KEY — falling back to heuristic classification.")
            USE_AI = False
    except Exception as e:
        print(f"[AI] Init failed: {e} — falling back to heuristic classification.")
        USE_AI = False

# ─────────────────────────────────────────────────────────────────────────────
# Reddit helpers
# ─────────────────────────────────────────────────────────────────────────────

HEADERS = {"User-Agent": "Crux-Seeder/1.0 (educational project)"}

def reddit_get(url: str, params: dict = None) -> dict:
    """Rate-limited Reddit fetch."""
    time.sleep(1.2)  # respect Reddit's "1 req/s for non-auth" guideline
    r = requests.get(url, headers=HEADERS, params=params, timeout=15)
    r.raise_for_status()
    return r.json()


def fetch_cmv_posts(limit: int, timeframe: str) -> list[dict]:
    """Return top CMV posts as simplified dicts."""
    data = reddit_get(
        f"https://www.reddit.com/r/changemyview/top.json",
        params={"limit": min(limit * 2, 50), "t": timeframe},  # fetch extra to filter
    )
    posts = []
    for child in data["data"]["children"]:
        p = child["data"]
        # Skip removed/deleted/stickied posts and very short ones
        if p.get("removed_by_category") or p.get("stickied"):
            continue
        body = p.get("selftext", "").strip()
        if not body or body in ("[removed]", "[deleted]") or len(body) < 80:
            continue
        posts.append({
            "id": p["id"],
            "title": p["title"],
            "body": body[:1500],  # cap body length
            "url": f"https://reddit.com{p['permalink']}",
            "author": p.get("author", "unknown"),
            "score": p.get("score", 0),
            "num_comments": p.get("num_comments", 0),
        })
        if len(posts) >= limit:
            break
    return posts


def fetch_comments(post_id: str, max_top_level: int) -> list[dict]:
    """Return a structured comment tree (2 levels deep)."""
    data = reddit_get(
        f"https://www.reddit.com/r/changemyview/comments/{post_id}.json",
        params={"limit": 50, "sort": "top", "depth": 3},
    )
    if len(data) < 2:
        return []

    results = []
    for child in data[1]["data"]["children"][:max_top_level]:
        c = child["data"]
        if c.get("body") in (None, "[removed]", "[deleted]", ""):
            continue
        if c.get("author") in ("[deleted]", "[removed]", "AutoModerator"):
            continue
        comment = {
            "id": c["id"],
            "author": c.get("author", "anon"),
            "body": c["body"].strip()[:800],
            "score": c.get("score", 1),
            "replies": [],
        }
        # One level of replies
        replies_data = c.get("replies", "")
        if isinstance(replies_data, dict):
            for rchild in replies_data["data"]["children"][:4]:
                r = rchild.get("data", {})
                if r.get("body") in (None, "[removed]", "[deleted]", ""):
                    continue
                if r.get("author") in ("[deleted]", "[removed]", "AutoModerator"):
                    continue
                comment["replies"].append({
                    "id": r["id"],
                    "author": r.get("author", "anon"),
                    "body": r["body"].strip()[:600],
                    "score": r.get("score", 1),
                })
        results.append(comment)
    return results


# ─────────────────────────────────────────────────────────────────────────────
# AI Classification
# ─────────────────────────────────────────────────────────────────────────────

VALID_NODE_TYPES = {"assertion", "counter", "qualification", "exception",
                    "synthesis", "reframe", "open_question", "concession"}
VALID_RELATIONSHIPS = {"supports", "challenges", "qualifies", "refines",
                       "contradicts", "synthesizes", "questions"}
VALID_NUANCE_TAGS = {"temporal", "geographic", "scale", "conditional",
                     "population_specific", "contested_empirically"}


def classify_thread_with_ai(post: dict, comments: list[dict]) -> dict:
    """
    Send the whole thread to Claude in one call.
    Returns { "op": {...}, "comments": [{...}], "question": str }
    """
    # Build compact thread representation
    thread_text = f"ORIGINAL POST:\n{post['body'][:800]}\n\n"
    for i, c in enumerate(comments):
        thread_text += f"COMMENT {i+1} (id={c['id']}):\n{c['body'][:500]}\n"
        for j, r in enumerate(c["replies"]):
            thread_text += f"  REPLY {i+1}.{j+1} (id={r['id']}, parent={c['id']}):\n  {r['body'][:400]}\n"
        thread_text += "\n"

    system_prompt = """You are classifying a Reddit r/changemyview debate thread for a structured argument platform.

NODE TYPES:
- assertion: makes a positive claim that could be challenged
- counter: directly opposes or refutes a parent claim
- qualification: narrows/limits a claim without fully opposing it
- exception: identifies a case where the parent claim breaks down
- synthesis: integrates multiple positions into a new understanding
- reframe: recontextualizes the debate with a different frame
- open_question: poses an unanswered question that challenges the debate
- concession: admits the parent has a valid point

EDGE RELATIONSHIP TYPES (from child → parent):
- challenges: directly opposes
- qualifies: limits or conditions
- contradicts: logically incompatible
- supports: provides evidence or agreement
- refines: improves parent argument
- synthesizes: merges multiple views
- questions: raises doubt without asserting

NUANCE TAGS (max 2 per node, optional):
empirical_claim, normative_claim, definitional_dispute, scope_limitation,
practical_concern, false_dichotomy, straw_man, slippery_slope, nuanced_agreement

Return ONLY valid JSON matching this exact schema:
{
  "canonical_question": "<a neutral debate question reformulating the OP's thesis>",
  "op_summary": "<1-sentence neutral summary of OP's main claim>",
  "nodes": [
    {
      "comment_id": "<reddit comment id>",
      "parent_comment_id": "<parent id or null for top-level comments>",
      "node_type": "<one of the node types above>",
      "summary": "<concise 1-sentence summary of this argument, max 120 chars>",
      "nuance_tags": ["<tag1>"],
      "relationship_to_parent": "<relationship type or null if no parent>"
    }
  ]
}"""

    response = _ai_client.messages.create(
        model="claude-3-5-haiku-20241022",  # fast + cheap for classification
        max_tokens=2000,
        system=system_prompt,
        messages=[{"role": "user", "content": thread_text}],
    )

    raw = response.content[0].text.strip()
    # Extract JSON even if wrapped in markdown
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        raise ValueError("No JSON in AI response")
    return json.loads(m.group())


def heuristic_classify(body: str, is_reply: bool, parent_body: str = "") -> dict:
    """Simple rule-based fallback when AI is not available."""
    text = body.lower()
    if any(w in text for w in ["however", "but", "disagree", "wrong", "not true", "actually"]):
        node_type = "counter"
        rel = "challenges"
    elif any(w in text for w in ["except", "unless", "only if", "caveat"]):
        node_type = "qualification"
        rel = "qualifies"
    elif any(w in text for w in ["good point", "agree", "fair", "you're right", "concede"]):
        node_type = "concession"
        rel = "supports"
    elif any(w in text for w in ["what if", "consider", "have you thought", "?"]):
        node_type = "open_question"
        rel = "questions"
    elif any(w in text for w in ["both sides", "middle ground", "nuance", "synthesis"]):
        node_type = "synthesis"
        rel = "synthesizes"
    elif is_reply:
        node_type = "counter"
        rel = "challenges"
    else:
        node_type = "counter"
        rel = "challenges"

    summary = body[:120].replace("\n", " ").strip()
    if len(body) > 120:
        summary = summary[:117] + "…"

    return {"node_type": node_type, "relationship": rel, "summary": summary, "nuance_tags": []}


# ─────────────────────────────────────────────────────────────────────────────
# DB helpers
# ─────────────────────────────────────────────────────────────────────────────

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# Safe migration: add new columns to existing SQLite DB if not present
from sqlalchemy import text as _sql_text
with engine.connect() as _conn:
    for _col, _defn in [("source_url", "TEXT"), ("node_count", "REAL DEFAULT 0")]:
        try:
            _conn.execute(_sql_text(f"ALTER TABLE topics ADD COLUMN {_col} {_defn}"))
            _conn.commit()
            print(f"[migration] Added topics.{_col}")
        except Exception:
            pass  # Column already exists


def get_or_create_bot_user(username: str, display_name: str, score: float = 55.0) -> User:
    u = db.query(User).filter(User.username == username).first()
    if u:
        return u
    u = User(
        email=f"{username}@reddit-import.crux",
        username=username,
        display_name=display_name,
        hashed_password=_bcrypt.hashpw(b"imported!", _bcrypt.gensalt()).decode(),
        credibility_score=score,
        is_verified_expert=False,
    )
    db.add(u)
    db.flush()
    return u


def safe_node_type(val: str) -> NodeType:
    return NodeType(val) if val in VALID_NODE_TYPES else NodeType.counter


def safe_edge_rel(val: str) -> EdgeRelationship:
    return EdgeRelationship(val) if val in VALID_RELATIONSHIPS else EdgeRelationship.challenges


def safe_nuance_tags(tags: list) -> list:
    return [NuanceTag(t) for t in (tags or []) if t in VALID_NUANCE_TAGS]


# ─────────────────────────────────────────────────────────────────────────────
# Main seeder
# ─────────────────────────────────────────────────────────────────────────────

if args.clear:
    print("Clearing existing data…")
    db.query(ArgumentEdge).delete()
    db.query(ArgumentNode).delete()
    db.query(DiscourseTrack).delete()
    db.query(Topic).delete()
    db.query(User).delete()
    db.commit()

# System bot account owns the topics
seed_bot = get_or_create_bot_user("crux_import", "Crux Import Bot", score=70.0)
db.commit()

print(f"\nFetching {args.limit} top CMV posts (timeframe: {args.timeframe})…")
posts = fetch_cmv_posts(args.limit, args.timeframe)
print(f"Found {len(posts)} usable posts.\n")

imported = 0
for post in posts:
    print(f"── [{post['id']}] {post['title'][:80]}")

    # Skip if already imported
    existing = db.query(Topic).filter(Topic.source_url == post["url"]).first()
    if existing:
        print("   Already imported, skipping.")
        continue

    # Fetch comments
    print("   Fetching comments…")
    comments = fetch_comments(post["id"], args.comments_per_thread)
    if not comments:
        print("   No usable comments, skipping.")
        continue
    print(f"   Got {len(comments)} top-level comments with replies.")

    # AI or heuristic classification
    ai_result = None
    canonical_question = post["title"].strip()
    if not canonical_question.endswith("?"):
        canonical_question += "?"
    op_summary = post["body"][:200]

    if USE_AI:
        try:
            print("   Classifying with Claude…")
            ai_result = classify_thread_with_ai(post, comments)
            canonical_question = ai_result.get("canonical_question", canonical_question)
            op_summary = ai_result.get("op_summary", op_summary)
            print(f"   → \"{canonical_question[:70]}\"")
        except Exception as e:
            print(f"   AI classification failed ({e}), using heuristics.")
            ai_result = None

    # Build lookup maps
    comment_map: dict[str, dict] = {}
    all_comments: list[dict] = []
    for c in comments:
        comment_map[c["id"]] = c
        all_comments.append(c)
        for r in c["replies"]:
            comment_map[r["id"]] = r
            all_comments.append(r)

    ai_node_map: dict[str, dict] = {}
    if ai_result:
        for node in ai_result.get("nodes", []):
            ai_node_map[node["comment_id"]] = node

    # ── Create Topic ────────────────────────────────────────────────────────

    topic = Topic(
        created_by=seed_bot.id,
        canonical_question=canonical_question,
        description=post["body"][:500],
        status=TopicStatus.active,
        tags=[],
        source_url=post["url"],
    )
    db.add(topic)
    db.flush()

    # ── Tracks ──────────────────────────────────────────────────────────────

    track_pro = DiscourseTrack(topic_id=topic.id, name="Pro", description="Arguments for the thesis")
    track_con = DiscourseTrack(topic_id=topic.id, name="Con", description="Arguments against the thesis")
    track_nuance = DiscourseTrack(topic_id=topic.id, name="Nuance", description="Qualifications and synthesis")
    db.add_all([track_pro, track_con, track_nuance])
    db.flush()

    track_for_type = {
        "assertion": track_pro,
        "counter": track_con,
        "qualification": track_nuance,
        "exception": track_nuance,
        "synthesis": track_nuance,
        "reframe": track_nuance,
        "open_question": track_nuance,
        "concession": track_pro,
    }

    # ── OP assertion node ───────────────────────────────────────────────────

    op_user = get_or_create_bot_user(
        f"reddit_{post['author'][:20]}",
        f"{post['author']} (Reddit)",
        score=random.uniform(50, 75),
    )
    db.flush()

    op_node = ArgumentNode(
        topic_id=topic.id,
        track_id=track_pro.id,
        author_id=op_user.id,
        content=post["body"][:800],
        node_type=NodeType.assertion,
        ai_summary=op_summary[:200] if op_summary else None,
        sources=[post["url"]],
        nuance_tags=[],
        state=ArgumentState.engaged,
        ai_classification_confidence=0.95,
    )
    db.add(op_node)
    db.flush()

    # ── Comment nodes ────────────────────────────────────────────────────────

    # Build a dict: reddit_id → ArgumentNode (to wire edges)
    node_db_map: dict[str, ArgumentNode] = {post["id"] + "_op": op_node}

    def build_nodes(comment_list: list[dict], parent_db_node: ArgumentNode, is_reply: bool):
        for c in comment_list:
            cid = c["id"]
            ai_info = ai_node_map.get(cid, {})

            node_type_str = ai_info.get("node_type", "")
            rel_str = ai_info.get("relationship_to_parent", "")
            summary = ai_info.get("summary", "") or c["body"][:120].replace("\n", " ")
            nuance_tags = safe_nuance_tags(ai_info.get("nuance_tags", []))

            if not node_type_str:
                h = heuristic_classify(c["body"], is_reply)
                node_type_str = h["node_type"]
                rel_str = h["relationship"]
                if not summary:
                    summary = h["summary"]

            node_type = safe_node_type(node_type_str)
            track = track_for_type.get(node_type_str, track_con)

            author = get_or_create_bot_user(
                f"reddit_{c['author'][:20]}",
                f"{c['author']} (Reddit)",
                score=random.uniform(40, 80),
            )
            db.flush()

            arg_node = ArgumentNode(
                topic_id=topic.id,
                track_id=track.id,
                parent_id=parent_db_node.id,
                author_id=author.id,
                content=c["body"][:800],
                node_type=node_type,
                ai_summary=summary[:200],
                sources=[],
                nuance_tags=nuance_tags,
                state=ArgumentState.unchallenged,
                ai_classification_confidence=0.80 if ai_info else 0.60,
            )
            db.add(arg_node)
            db.flush()

            node_db_map[cid] = arg_node

            # Wire edge
            rel = safe_edge_rel(rel_str)
            edge = ArgumentEdge(
                source_id=arg_node.id,
                target_id=parent_db_node.id,
                relationship_type=rel,
            )
            db.add(edge)

            # Recurse into replies
            if c.get("replies"):
                build_nodes(c["replies"], arg_node, is_reply=True)

    build_nodes(comments, op_node, is_reply=False)

    # Update node count on topic
    topic.node_count = db.query(ArgumentNode).filter(ArgumentNode.topic_id == topic.id).count()
    db.commit()

    imported += 1
    total_nodes = db.query(ArgumentNode).filter(ArgumentNode.topic_id == topic.id).count()
    print(f"   ✓ Imported: {total_nodes} argument nodes, {len(comments)} threads\n")

print(f"\n{'='*60}")
print(f"Done! Imported {imported} debate(s) from Reddit r/changemyview.")
print(f"Open http://localhost:5173 to explore them in Crux.")
