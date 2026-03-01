"""
News feed router — serves raw news headlines for the live ticker.
"""
from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("")
def get_news_feed(
    category: Optional[str] = Query(
        None,
        description="Filter: geopolitical, technology, economic, social, environment",
    ),
    limit: int = Query(20, ge=1, le=50),
):
    """Fetch recent news headlines from multiple categories for the ticker."""
    from app.services.news_service import fetch_news_feed, get_status

    articles = fetch_news_feed(category=category, limit=limit)

    return {
        "articles": articles,
        "count": len(articles),
        "status": get_status(),
    }
