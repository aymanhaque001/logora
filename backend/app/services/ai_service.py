"""
AI service using Claude API.
Falls back to stub responses when ANTHROPIC_API_KEY is not set.
Real errors are printed to stderr so they appear in server logs.
"""
import json
import sys
from typing import Optional
from app.config import settings

_client = None
_init_error = None

try:
    import anthropic
    if settings.ANTHROPIC_API_KEY:
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        print(f"[AI] Anthropic client initialised. Model: {settings.CLAUDE_MODEL}", file=sys.stderr)
    else:
        print("[AI] No ANTHROPIC_API_KEY set — running in stub mode.", file=sys.stderr)
except Exception as e:
    _init_error = str(e)
    print(f"[AI] Failed to initialise Anthropic client: {e}", file=sys.stderr)


def is_available() -> bool:
    return _client is not None


def _call_claude(system: str, user: str) -> str:
    message = _client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=1500,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return message.content[0].text


# ── Node Classification ───────────────────────────────────────────────────────

def classify_node(content: str, parent_content: Optional[str], node_type_hint: str) -> dict:
    if not is_available():
        return _stub_classify(content, node_type_hint)

    system = """You are an expert in argument analysis and structured debate.
Classify an argument node submitted to a fact-based debate platform.

Node types:
- assertion: Makes a positive claim (requires evidence)
- counter: Directly challenges a previous argument
- qualification: "True, but only under condition X"
- exception: "This breaks down in case Y"
- synthesis: Points of genuine agreement between positions
- reframe: Suggests the real question is different from assumed
- open_question: Raises something nobody has addressed
- concession: Acknowledges a valid point from the other side

Respond with valid JSON only. No markdown fences, no explanation outside the JSON."""

    parts = [f'Node content: "{content}"']
    if parent_content:
        parts.append(f'Parent argument: "{parent_content}"')
    parts.append(f'User-selected type: {node_type_hint}')
    parts.append("""Return JSON:
{
  "confirmed_type": "<node_type>",
  "confidence": <0.0-1.0>,
  "reasoning": "<one sentence>",
  "suggested_track_theme": "<short theme, e.g. Economic effects>",
  "nuance_tags": []
}""")

    try:
        raw = _call_claude(system, "\n".join(parts))
        # Strip markdown fences if model wraps in ```json
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(raw)
    except Exception as e:
        print(f"[AI] classify_node error: {e}", file=sys.stderr)
        return _stub_classify(content, node_type_hint)


def _stub_classify(content: str, node_type_hint: str) -> dict:
    return {
        "confirmed_type": node_type_hint,
        "confidence": 0.75,
        "reasoning": "AI classification unavailable.",
        "suggested_track_theme": "General",
        "nuance_tags": [],
    }


# ── Debate Briefing ───────────────────────────────────────────────────────────

def generate_briefing(topic_question: str, nodes_summary: list, tracks: list) -> dict:
    if not is_available():
        return _stub_briefing(topic_question, nodes_summary, tracks)

    system = """You are a neutral debate analyst. Summarise the current state of a structured debate.
Do NOT take sides. Map what has been argued, what is contested, and what remains open.
Respond with valid JSON only. No markdown fences."""

    node_text = "\n".join([
        f"[{n['node_type'].upper()}] {n['content'][:180]} (state: {n['state']})"
        for n in nodes_summary[:50]
    ])
    track_text = ", ".join([t['name'] for t in tracks]) if tracks else "None yet"

    user = f"""Topic: {topic_question}

Discourse tracks: {track_text}

Arguments:
{node_text or "No arguments yet."}

Return JSON:
{{
  "summary": "<2-3 sentence neutral summary of where the debate currently stands>",
  "key_positions": [
    {{"position": "<label>", "core_claim": "<claim>", "strength": "strong|moderate|weak"}}
  ],
  "main_areas_of_contention": ["<area1>", "<area2>"],
  "what_has_been_left_unaddressed": "<observation about gaps in the debate>",
  "discourse_health": {{
    "engagement_quality": "high|medium|low",
    "nuance_present": true,
    "echo_chamber_risk": "high|medium|low",
    "assessment": "<one sentence assessment of debate quality>"
  }}
}}"""

    try:
        raw = _call_claude(system, user)
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(raw)
        data["ai_powered"] = True
        return data
    except Exception as e:
        print(f"[AI] generate_briefing error: {e}", file=sys.stderr)
        return _stub_briefing(topic_question, nodes_summary, tracks)


def _stub_briefing(topic_question: str, nodes_summary: list, tracks: list) -> dict:
    count = len(nodes_summary)
    return {
        "summary": f"This debate has {count} argument{'s' if count != 1 else ''} across {len(tracks)} track{'s' if len(tracks) != 1 else ''}.",
        "key_positions": [],
        "main_areas_of_contention": [],
        "what_has_been_left_unaddressed": "Add your ANTHROPIC_API_KEY to .env to enable AI analysis.",
        "discourse_health": {
            "engagement_quality": "medium",
            "nuance_present": False,
            "echo_chamber_risk": "low",
            "assessment": "AI analysis unavailable — add API key to backend/.env to enable.",
        },
        "ai_powered": False,
    }


# ── Node Summary ─────────────────────────────────────────────────────────────

def summarize_node(content: str) -> Optional[str]:
    """Generate a concise 1-sentence summary for display in graph nodes."""
    if not is_available():
        return None

    system = "You are a debate analyst. Summarise an argument in one short sentence (max 12 words). Output only the sentence, no quotes, no punctuation at end."
    user = f'Argument: "{content[:300]}"'

    try:
        result = _call_claude(system, user).strip().strip('"').strip("'")
        return result if result else None
    except Exception as e:
        print(f"[AI] summarize_node error: {e}", file=sys.stderr)
        return None


# ── Track Detection ───────────────────────────────────────────────────────────

def detect_track_for_node(content: str, existing_tracks: list) -> Optional[str]:
    if not is_available() or not existing_tracks:
        return None

    system = "You are a topic categorisation assistant. Respond with valid JSON only."
    track_list = "\n".join([
        f"- ID: {t['id']}, Name: {t['name']}"
        for t in existing_tracks
    ])

    user = f"""Argument: "{content}"

Tracks:
{track_list}

Does this argument clearly belong to one of these tracks?
Return: {{"track_id": "<id or null>", "confidence": <0.0-1.0>}}"""

    try:
        raw = _call_claude(system, user)
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(raw)
        return data.get("track_id") if data.get("confidence", 0) > 0.7 else None
    except Exception as e:
        print(f"[AI] detect_track error: {e}", file=sys.stderr)
        return None


# ── Status ────────────────────────────────────────────────────────────────────

def get_status() -> dict:
    return {
        "ai_enabled": is_available(),
        "model": settings.CLAUDE_MODEL if is_available() else None,
        "init_error": _init_error,
    }
