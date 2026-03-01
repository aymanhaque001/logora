"""
News feed service — fetches raw headlines from DuckDuckGo for the live ticker.
Separate from web_search_service to avoid mixing ticker data with debate framing.
"""
import sys
import hashlib
from typing import Optional

try:
    from duckduckgo_search import DDGS
    _ddgs_available = True
except ImportError:
    _ddgs_available = False
    print("[News] duckduckgo-search not installed — news feed disabled.", file=sys.stderr)

# Broader set of queries for a diverse news feed
NEWS_QUERIES: dict[str, list[str]] = {
    "geopolitical": [
        "international relations news today",
        "geopolitics breaking news",
    ],
    "technology": [
        "technology news today",
        "AI artificial intelligence news",
    ],
    "economic": [
        "global economy news today",
        "financial markets breaking news",
    ],
    "social": [
        "social issues news today",
        "human rights news",
    ],
    "environment": [
        "climate change environment news",
        "energy policy news today",
    ],
}


def _fetch_raw_news(query: str, max_results: int = 8) -> list[dict]:
    """Run a DuckDuckGo news search and return raw articles."""
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
                "image": r.get("image", ""),
            }
            for r in results
        ]
    except Exception as e:
        print(f"[News] Search error for '{query}': {e}", file=sys.stderr)
        return []


def _deduplicate(articles: list[dict]) -> list[dict]:
    """Remove duplicate articles by title similarity."""
    seen = set()
    unique = []
    for a in articles:
        # Normalize title for dedup
        key = hashlib.md5(a["title"].lower().strip().encode()).hexdigest()[:12]
        if key not in seen:
            seen.add(key)
            unique.append(a)
    return unique


def _classify_category(query: str) -> str:
    """Infer category from the query used to fetch the article."""
    for cat, queries in NEWS_QUERIES.items():
        for q in queries:
            if q == query:
                return cat
    return "general"


def fetch_news_feed(
    category: Optional[str] = None,
    limit: int = 20,
) -> list[dict]:
    """
    Fetch a feed of raw news articles for the ticker.
    Returns articles with: title, body, url, source, date, category.
    """
    raw_results: list[dict] = []

    if category and category in NEWS_QUERIES:
        # Single category
        for q in NEWS_QUERIES[category]:
            results = _fetch_raw_news(q, max_results=limit // 2 + 1)
            for r in results:
                r["category"] = category
            raw_results.extend(results)
    else:
        # All categories — pull a few from each
        per_cat = max(2, limit // len(NEWS_QUERIES))
        for cat, queries in NEWS_QUERIES.items():
            q = queries[0]  # Primary query for each category
            results = _fetch_raw_news(q, max_results=per_cat)
            for r in results:
                r["category"] = cat
            raw_results.extend(results)

    if not raw_results:
        return _fallback_news()

    # Deduplicate and limit
    unique = _deduplicate(raw_results)
    return unique[:limit]


def _fallback_news() -> list[dict]:
    """Hardcoded fallback when search is unavailable."""
    return [
        {
            "title": "Global leaders meet to discuss AI governance frameworks",
            "body": "World leaders are convening to establish international guidelines for AI development and deployment.",
            "url": "",
            "source": "Fallback",
            "date": "",
            "category": "technology",
        },
        {
            "title": "New climate report warns of accelerating ice sheet loss",
            "body": "Scientists report unprecedented rates of ice loss in Greenland and Antarctica.",
            "url": "",
            "source": "Fallback",
            "date": "",
            "category": "environment",
        },
        {
            "title": "Central banks signal policy shifts amid inflation concerns",
            "body": "Major central banks are reassessing monetary policy as inflation patterns shift globally.",
            "url": "",
            "source": "Fallback",
            "date": "",
            "category": "economic",
        },
        {
            "title": "International court issues ruling on maritime boundary disputes",
            "body": "A landmark ruling could reshape territorial claims in contested waters.",
            "url": "",
            "source": "Fallback",
            "date": "",
            "category": "geopolitical",
        },
    ]


def get_status() -> dict:
    return {
        "news_available": _ddgs_available,
    }
