"""
Credibility scoring system.

Users earn or lose credibility based on their debate behaviour:
- Submitting sourced arguments:  +2
- Submitting unsourced arguments: +0.5
- Having an argument engaged:    +1
- Conceding gracefully:          +3  (intellectual honesty)
- Having an argument conceded to: +2

Score is clamped to [0, 100].
"""
from sqlalchemy.orm import Session


# Points awarded per action
POINTS = {
    "submit_sourced":   2.0,
    "submit_unsourced": 0.5,
    "engaged":          1.0,
    "concede":          3.0,
    "conceded_to":      2.0,
}


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def award_credibility(
    user,
    action: str,
    *,
    has_sources: bool = False,
    db: Session,
):
    """
    Award credibility points for a user action.

    Actions:
        submit_argument  – user submitted an argument (check has_sources)
        concede          – user conceded a point (intellectual honesty bonus)
        engaged          – user's argument received engagement
        conceded_to      – another user conceded to this user
    """
    delta = 0.0

    if action == "submit_argument":
        delta = POINTS["submit_sourced"] if has_sources else POINTS["submit_unsourced"]
    elif action in POINTS:
        delta = POINTS[action]
    else:
        return  # Unknown action, no-op

    user.credibility_score = _clamp(user.credibility_score + delta)
    db.commit()
