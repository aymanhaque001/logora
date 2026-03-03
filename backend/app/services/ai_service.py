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

def classify_node(
    content: str,
    parent_content: Optional[str],
    node_type_hint: str,
    topic_question: str = "",
    existing_track_names: Optional[list[str]] = None,
) -> dict:
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

When suggesting a track theme:
- Be SPECIFIC and SUBSTANTIVE — name the actual sub-topic being discussed
- NEVER use generic labels like "pro", "cons", "nuance", "support", "opposition", "arguments for/against"
- Good examples: "Housing displacement", "Tax revenue effects", "Methodological disputes", "Equity & access"
- The theme should describe WHAT is being debated, not the STANCE of the argument
- If existing tracks are provided, prefer assigning to one of those unless the argument clearly opens a new substantive area

Respond with valid JSON only. No markdown fences, no explanation outside the JSON."""

    parts = []
    if topic_question:
        parts.append(f'Debate question: "{topic_question}"')
    if existing_track_names:
        parts.append(f'Existing currents: {", ".join(existing_track_names)}')
    parts.append(f'Node content: "{content}"')
    if parent_content:
        parts.append(f'Parent argument: "{parent_content}"')
    parts.append(f'User-selected type: {node_type_hint}')
    parts.append("""Return JSON:
{
  "confirmed_type": "<node_type>",
  "confidence": <0.0-1.0>,
  "reasoning": "<one sentence>",
  "suggested_track_theme": "<specific substantive theme — NOT pro/con/nuance>",
  "nuance_tags": []
}""")

    try:
        raw = _call_claude(system, "\n".join(parts))
        # Strip markdown fences if model wraps in ```json
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        result = json.loads(raw)
        # Guard against generic themes
        theme = (result.get("suggested_track_theme") or "").lower().strip()
        generic = {"pro", "pros", "con", "cons", "nuance", "nuances", "support",
                   "opposition", "for", "against", "arguments for", "arguments against",
                   "general", "other", "miscellaneous", "mixed"}
        if theme in generic:
            result["suggested_track_theme"] = "General"
        return result
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

def summarize_node(content: str, node_type: str = "") -> Optional[str]:
    """Distil an argument into its core epistemic concept for knowledge-graph display."""
    if not is_available():
        return None

    type_hint = f" This is a {node_type} argument." if node_type else ""
    system = (
        "You are a knowledge-graph curator distilling debate arguments into their core epistemic claim.\n"
        "Rules:\n"
        "- ONE sentence, max 18 words\n"
        "- Lead with the CLAIM itself (not 'The author argues...')\n"
        "- Capture the logical essence, not the rhetoric\n"
        "- Output only the sentence, no quotes, no trailing punctuation"
    )
    user = f'Argument ({node_type}):{type_hint}\n"{content[:400]}"'

    try:
        result = _call_claude(system, user).strip().strip('"').strip("'").rstrip('.')
        return result if len(result) > 5 else None
    except Exception as e:
        print(f"[AI] summarize_node error: {e}", file=sys.stderr)
        return None


def batch_summarize_nodes(nodes: list[dict]) -> dict[str, str]:
    """
    Summarize a batch of nodes in a single Claude call.
    nodes: list of {id, content, node_type}
    Returns: {id: summary}
    """
    if not is_available() or not nodes:
        return {}

    lines = []
    for i, n in enumerate(nodes[:40]):  # cap at 40 per call
        lines.append(f"{i+1}. [{n['node_type'].upper()}] {n['content'][:300]}")

    system = (
        "You are a knowledge-graph curator. For each numbered argument below, write ONE sentence "
        "(max 18 words) that captures its core epistemic claim. Lead with the claim itself. "
        "Respond with ONLY a JSON object mapping number to summary, e.g. {\"1\": \"...\", \"2\": \"...\"}"
    )
    user = "\n".join(lines)

    try:
        raw = _call_claude(system, user).strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        numbered = json.loads(raw)
        return {
            nodes[int(k) - 1]["id"]: v.strip().rstrip(".")
            for k, v in numbered.items()
            if int(k) - 1 < len(nodes)
        }
    except Exception as e:
        print(f"[AI] batch_summarize error: {e}", file=sys.stderr)
        return {}


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


# ── Dynamic Current Discovery ─────────────────────────────────────────────────

def discover_currents(
    topic_question: str,
    arguments: list[dict],
) -> list[dict]:
    """
    Analyze ALL arguments in a topic and discover emergent thematic currents.
    Returns a list of currents, each with a name, description, and list of argument IDs.

    arguments: list of {id, content, node_type, parent_id}
    """
    if not is_available() or len(arguments) < 3:
        return _stub_discover_currents(arguments)

    system = """You are an expert discourse analyst. You find the EMERGENT THEMATIC CURRENTS
in a structured debate — the distinct lines of thinking, sub-topics, and angles
that organically develop as people contribute arguments.

CRITICAL RULES for naming currents:
- Name each current after the SUBSTANTIVE TOPIC it addresses (e.g. "Tax revenue effects",
  "Displacement mechanisms", "Methodological disputes", "Environmental externalities")
- NEVER name a current after stance/position ("Pro", "Con", "Support", "Opposition")
- NEVER name a current generically ("Nuance", "Arguments", "Discussion", "Points")
- Each current should represent a distinct ASPECT or ANGLE of the debate
- Arguments that respond to each other often belong to the SAME current despite taking
  opposite sides — they're debating the same sub-topic
- 3-7 currents is typical; prefer fewer, more meaningful groupings over many small ones
- Every argument should belong to exactly one current

Respond with valid JSON only. No markdown fences."""

    arg_lines = "\n".join([
        f"[{i+1}] ({a['node_type']}) {a['content'][:250]}"
        for i, a in enumerate(arguments[:60])
    ])

    user = f"""Debate question: "{topic_question}"

Arguments ({len(arguments)} total):
{arg_lines}

Identify the distinct thematic currents in this debate.

Return JSON:
{{
  "currents": [
    {{
      "name": "<specific substantive theme name, 2-5 words>",
      "description": "<one sentence describing what this current explores>",
      "argument_indices": [<1-based indices of arguments belonging to this current>]
    }}
  ]
}}"""

    try:
        raw = _call_claude(system, user)
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(raw)
        currents = data.get("currents", [])

        # Map 1-based indices back to actual argument IDs
        result = []
        for c in currents:
            indices = c.get("argument_indices", [])
            arg_ids = []
            for idx in indices:
                if 1 <= idx <= len(arguments):
                    arg_ids.append(arguments[idx - 1]["id"])
            if arg_ids:  # only include currents that have arguments
                result.append({
                    "name": c["name"],
                    "description": c.get("description", ""),
                    "argument_ids": arg_ids,
                })
        return result
    except Exception as e:
        print(f"[AI] discover_currents error: {e}", file=sys.stderr)
        return _stub_discover_currents(arguments)


def _stub_discover_currents(arguments: list[dict]) -> list[dict]:
    """Fallback: group by node_type families when AI is unavailable."""
    from collections import defaultdict
    groups = defaultdict(list)
    type_labels = {
        "assertion": "Core claims",
        "counter": "Core claims",
        "qualification": "Conditions & exceptions",
        "exception": "Conditions & exceptions",
        "synthesis": "Points of convergence",
        "reframe": "Re-framings",
        "open_question": "Open questions",
        "concession": "Points of convergence",
    }
    for a in arguments:
        label = type_labels.get(a["node_type"], "Core claims")
        groups[label].append(a["id"])

    return [
        {"name": name, "description": f"Arguments grouped as {name.lower()}", "argument_ids": ids}
        for name, ids in groups.items()
        if ids
    ]


# ── Track Evolution Summary ────────────────────────────────────────────────────

def summarize_track_evolution(track_name: str, chain_nodes: list[dict]) -> Optional[str]:
    """Generate a one-sentence summary of how a concept evolved across arguments."""
    if not is_available() or len(chain_nodes) < 2:
        return None

    system = (
        "You summarise how a line of thinking evolves within a debate. "
        "Write ONE sentence (max 30 words) that captures the arc — "
        "e.g. 'Started as a cost concern, then shifted to equity after counter-evidence on savings.' "
        "Output ONLY the sentence."
    )

    steps = "\n".join([
        f"{i+1}. [{n['node_type'].upper()}] {n['content'][:150]}"
        for i, n in enumerate(chain_nodes[:20])
    ])

    user = f'Track theme: "{track_name}"\n\nArgument chain:\n{steps}'

    try:
        return _call_claude(system, user).strip().strip('"').rstrip(".")
    except Exception as e:
        print(f"[AI] summarize_track_evolution error: {e}", file=sys.stderr)
        return None


# ── Catch-Up Briefing ─────────────────────────────────────────────────────────

def generate_catch_up(
    topic_question: str,
    nodes_summary: list,
    user_expertise: str | None = None,
) -> dict:
    if not is_available():
        return _stub_catch_up(topic_question, nodes_summary)

    system = """You are a neutral debate analyst helping a newcomer understand an ongoing structured debate.
Summarise the current state so they can contribute meaningfully.
Do NOT take sides. Categorise arguments clearly.
Respond with valid JSON only. No markdown fences."""

    node_text = "\n".join([
        f"[{n['node_type'].upper()}] (state: {n['state']}) {n['content'][:180]}"
        for n in nodes_summary[:50]
    ])

    expertise_hint = ""
    if user_expertise:
        expertise_hint = f"\nThe newcomer has expertise in: {user_expertise}. Tailor contribution suggestions accordingly."

    user = f"""Topic: {topic_question}{expertise_hint}

Arguments so far:
{node_text or "No arguments yet."}

Return JSON:
{{
  "summary": "<2-3 sentence overview of where the debate stands for a newcomer>",
  "established_points": [
    {{"claim": "<claim>", "basis": "<why it is established>"}}
  ],
  "refuted_points": [
    {{"claim": "<original claim>", "rebuttal": "<what refuted it>"}}
  ],
  "active_debates": [
    {{"topic": "<debate topic>", "sides": "<brief description of sides>"}}
  ],
  "contribution_suggestions": [
    {{"opportunity_type": "gap|unchallenged_claim|unanswered_question", "suggestion": "<what the newcomer could do>"}}
  ]
}}"""

    try:
        raw = _call_claude(system, user)
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(raw)
        data["ai_powered"] = True
        return data
    except Exception as e:
        print(f"[AI] generate_catch_up error: {e}", file=sys.stderr)
        return _stub_catch_up(topic_question, nodes_summary)


def _stub_catch_up(topic_question: str, nodes_summary: list) -> dict:
    count = len(nodes_summary)
    unchallenged = [n for n in nodes_summary if n.get("state") == "unchallenged"]
    conceded = [n for n in nodes_summary if n.get("state") == "conceded"]
    engaged = [n for n in nodes_summary if n.get("state") in ("engaged", "branched")]

    established = [
        {"claim": n["content"][:120], "basis": "Unchallenged by other participants"}
        for n in unchallenged[:3]
    ]
    refuted = [
        {"claim": n["content"][:120], "rebuttal": "Author conceded this point"}
        for n in conceded[:3]
    ]
    active = [
        {"topic": n["content"][:80], "sides": "Multiple participants engaged"}
        for n in engaged[:3]
    ]
    suggestions = []
    open_questions = [n for n in nodes_summary if n.get("node_type") == "open_question"]
    for n in open_questions[:2]:
        suggestions.append({
            "opportunity_type": "unanswered_question",
            "suggestion": f"Address: {n['content'][:100]}",
        })
    if unchallenged:
        suggestions.append({
            "opportunity_type": "unchallenged_claim",
            "suggestion": "Challenge or support one of the unchallenged assertions with evidence.",
        })

    return {
        "summary": f"This debate has {count} argument{'s' if count != 1 else ''} on the question: {topic_question}",
        "established_points": established,
        "refuted_points": refuted,
        "active_debates": active,
        "contribution_suggestions": suggestions,
        "ai_powered": False,
    }


# ── Status ────────────────────────────────────────────────────────────────────

def get_status() -> dict:
    return {
        "ai_enabled": is_available(),
        "model": settings.CLAUDE_MODEL if is_available() else None,
        "init_error": _init_error,
    }
