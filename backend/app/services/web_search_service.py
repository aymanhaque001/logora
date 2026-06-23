"""
Web search service for suggesting debate topics from recent news.
Uses DuckDuckGo search (no API key needed) + Claude for debate framing.
"""
import json
import sys
from typing import Optional
from app.config import settings

try:
    from duckduckgo_search import DDGS
    _ddgs_available = True
except ImportError:
    _ddgs_available = False
    print("[WebSearch] duckduckgo-search not installed — web suggestions disabled.", file=sys.stderr)


# Search categories that map to Crux's topic tags
SEARCH_QUERIES = {
    "geopolitical": [
        "geopolitical conflict debate 2025",
        "international relations controversy today",
        "territorial dispute developing",
    ],
    "technology": [
        "AI regulation debate 2025",
        "tech policy controversy",
        "social media regulation news",
    ],
    "economic": [
        "economic policy debate 2025",
        "trade war tariff controversy",
        "inequality economics news",
    ],
    "social": [
        "social policy controversy 2025",
        "civil rights debate news",
        "education policy reform debate",
    ],
    "environment": [
        "climate policy debate 2025",
        "energy transition controversy",
        "environmental regulation news",
    ],
}


def _search_news(query: str, max_results: int = 5) -> list[dict]:
    """Run a DuckDuckGo news search and return results."""
    if not _ddgs_available:
        return []
    try:
        with DDGS() as ddgs:
            results = list(ddgs.news(query, max_results=max_results))
        return [
            {
                "title": r.get("title", ""),
                "body": r.get("body", ""),
                "url": r.get("url", ""),
                "source": r.get("source", ""),
                "date": r.get("date", ""),
            }
            for r in results
        ]
    except Exception as e:
        print(f"[WebSearch] Search error for '{query}': {e}", file=sys.stderr)
        return []


def _search_text(query: str, max_results: int = 5) -> list[dict]:
    """Run a DuckDuckGo text search and return results."""
    if not _ddgs_available:
        return []
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        return [
            {
                "title": r.get("title", ""),
                "body": r.get("body", ""),
                "url": r.get("href", ""),
            }
            for r in results
        ]
    except Exception as e:
        print(f"[WebSearch] Search error for '{query}': {e}", file=sys.stderr)
        return []


def search_for_debate_topics(
    category: Optional[str] = None,
    custom_query: Optional[str] = None,
    max_suggestions: int = 5,
) -> list[dict]:
    """
    Search the web for recent news and frame them as debate suggestions.
    Returns a list of debate suggestions with question, description, source, tags.
    """
    # Gather raw search results
    raw_results = []

    if custom_query:
        raw_results.extend(_search_news(custom_query, max_results=8))
        if len(raw_results) < 3:
            raw_results.extend(_search_text(custom_query + " debate controversy", max_results=5))
    elif category and category in SEARCH_QUERIES:
        for q in SEARCH_QUERIES[category]:
            raw_results.extend(_search_news(q, max_results=3))
    else:
        # Search across all categories
        for cat_queries in SEARCH_QUERIES.values():
            q = cat_queries[0]  # Take the primary query from each category
            raw_results.extend(_search_news(q, max_results=2))

    if not raw_results:
        return _fallback_suggestions()

    # Use Claude to frame the results as debate questions
    return _frame_as_debates(raw_results, max_suggestions)


def _frame_as_debates(articles: list[dict], max_suggestions: int) -> list[dict]:
    """Use Claude to convert news articles into well-framed debate questions."""
    from app.services.ai_service import is_available, _call_claude

    articles_text = "\n\n".join([
        f"ARTICLE {i+1}:\nTitle: {a['title']}\nSummary: {a['body'][:300]}\nSource: {a.get('source', a.get('url', 'unknown'))}\nURL: {a.get('url', '')}"
        for i, a in enumerate(articles[:15])
    ])

    if not is_available():
        return _stub_frame(articles, max_suggestions)

    system = """You are a debate topic curator for a structured, evidence-based debate platform called Crux.
Your job is to identify debatable questions from recent news articles.

Rules:
- Frame questions that have genuine two-sided arguments (not just "is X bad?")
- Questions MUST end with a question mark
- Be specific enough that people can bring evidence
- Avoid loaded or leading questions
- Tag each with relevant categories from: geographic, social, economic, scientific, political, environmental
- Suggest a location if the topic is geographically specific

Respond with valid JSON only. No markdown fences."""

    user = f"""Here are recent news articles. Identify the {max_suggestions} most debatable topics and frame them as structured debate questions.

{articles_text}

Return JSON:
{{
  "suggestions": [
    {{
      "canonical_question": "<well-framed debate question ending with ?>",
      "description": "<2-3 sentence description of why this is debatable>",
      "tags": ["<tag1>", "<tag2>"],
      "location": "<location or null>",
      "source_article": "<title of the article that inspired this>",
      "source_url": "<url of the article>",
      "timeliness": "breaking|recent|ongoing"
    }}
  ]
}}"""

    try:
        raw = _call_claude(system, user)
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(raw)
        suggestions = data.get("suggestions", [])
        for s in suggestions:
            s["ai_framed"] = True
        return suggestions[:max_suggestions]
    except Exception as e:
        print(f"[WebSearch] Claude framing error: {e}", file=sys.stderr)
        return _stub_frame(articles, max_suggestions)


def _stub_frame(articles: list[dict], max_suggestions: int) -> list[dict]:
    """Fallback: return articles as-is with simple formatting."""
    suggestions = []
    seen_titles = set()
    for a in articles:
        title = a.get("title", "").strip()
        if not title or title in seen_titles:
            continue
        seen_titles.add(title)
        # Simple heuristic: frame title as a question
        q = title.rstrip(".")
        if not q.endswith("?"):
            q = f"Should we debate: {q}?"
        suggestions.append({
            "canonical_question": q,
            "description": a.get("body", "")[:200],
            "tags": ["political"],
            "location": None,
            "source_article": title,
            "source_url": a.get("url", ""),
            "timeliness": "recent",
            "ai_framed": False,
        })
        if len(suggestions) >= max_suggestions:
            break
    return suggestions


def _fallback_suggestions() -> list[dict]:
    """Hardcoded suggestions when search is unavailable."""
    return [
        {
            "canonical_question": "Should NATO continue expanding its membership to include countries bordering Russia?",
            "description": "NATO expansion has been a persistent source of tension. Proponents argue it strengthens European security; critics say it provokes Russian aggression.",
            "tags": ["political", "geographic"],
            "location": "Europe",
            "source_article": "Suggested topic (search unavailable)",
            "source_url": "",
            "timeliness": "ongoing",
            "ai_framed": False,
        },
        {
            "canonical_question": "Is the global shift toward electric vehicles happening fast enough to meet climate targets?",
            "description": "EV adoption is accelerating but faces infrastructure, supply chain, and affordability challenges. Are current trajectories sufficient?",
            "tags": ["environmental", "economic", "scientific"],
            "location": None,
            "source_article": "Suggested topic (search unavailable)",
            "source_url": "",
            "timeliness": "ongoing",
            "ai_framed": False,
        },
    ]


def get_status() -> dict:
    return {
        "search_available": _ddgs_available,
        "ai_framing_available": True,  # Inherits from ai_service
    }
