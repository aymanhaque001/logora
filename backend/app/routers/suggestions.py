"""
Web search router — surfaces debate suggestions from recent news.
"""
from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter(prefix="/api/suggestions", tags=["suggestions"])


@router.get("")
def get_debate_suggestions(
    category: Optional[str] = Query(None, description="Filter: geopolitical, technology, economic, social, environment"),
    q: Optional[str] = Query(None, description="Custom search query"),
    limit: int = Query(5, ge=1, le=10),
):
    """Search the web for recent news and suggest debate topics."""
    from app.services.web_search_service import search_for_debate_topics, get_status

    suggestions = search_for_debate_topics(
        category=category,
        custom_query=q,
        max_suggestions=limit,
    )

    return {
        "suggestions": suggestions,
        "count": len(suggestions),
        "status": get_status(),
    }
