from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Topic, DiscourseTrack, ArgumentNode, User
from app.schemas import TopicCreate, TopicUpdate, TopicOut, TrackCreate, TrackOut, BriefingData, CatchUpData, ContributionOpportunity, ArgumentNodeOut
from app.models import TopicStatus
from app.auth import get_current_user, get_optional_user
from app.services import ai_service
from app.services.credibility import award_credibility

router = APIRouter(prefix="/api/topics", tags=["topics"])


def _enrich_topic(topic: Topic, db: Session) -> TopicOut:
    out = TopicOut.model_validate(topic)
    out.node_count = db.query(ArgumentNode).filter(ArgumentNode.topic_id == topic.id).count()
    out.track_count = db.query(DiscourseTrack).filter(DiscourseTrack.topic_id == topic.id).count()
    return out


@router.get("", response_model=List[TopicOut])
def list_topics(
    tag: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Topic)
    if search:
        q = q.filter(Topic.canonical_question.ilike(f"%{search}%"))
    if tag:
        # tags is stored as JSON array — filter rows where the tag appears
        q = q.filter(Topic.tags.contains(tag))
    if status:
        q = q.filter(Topic.status == status)
    topics = q.order_by(Topic.created_at.desc()).limit(50).all()
    # For SQLite JSON filtering fallback: filter in Python if .contains isn't supported
    if tag:
        topics = [t for t in topics if tag in (t.tags or [])]
    return [_enrich_topic(t, db) for t in topics]


@router.post("", response_model=TopicOut, status_code=status.HTTP_201_CREATED)
def create_topic(
    payload: TopicCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    topic = Topic(
        canonical_question=payload.canonical_question,
        description=payload.description,
        tags=payload.tags,
        location=payload.location,
        created_by=current_user.id,
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return _enrich_topic(topic, db)


@router.get("/{topic_id}", response_model=TopicOut)
def get_topic(topic_id: str, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return _enrich_topic(topic, db)


@router.patch("/{topic_id}", response_model=TopicOut)
def update_topic(
    topic_id: str,
    payload: TopicUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    if topic.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can edit this topic")
    if topic.status == TopicStatus.historical:
        raise HTTPException(status_code=400, detail="Cannot edit archived topics")
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(topic, field, value)
    db.commit()
    db.refresh(topic)
    return _enrich_topic(topic, db)


@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(
    topic_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    if topic.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can delete this topic")
    node_count = db.query(ArgumentNode).filter(ArgumentNode.topic_id == topic_id).count()
    if node_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete a topic with arguments. Archive it instead.")
    db.delete(topic)
    db.commit()
    return None


@router.post("/{topic_id}/archive", response_model=TopicOut)
def archive_topic(
    topic_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    if topic.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can archive this topic")
    topic.status = TopicStatus.historical
    db.commit()
    db.refresh(topic)
    return _enrich_topic(topic, db)


# ── Topic Status Lifecycle ─────────────────────────────────────────────────────

@router.post("/lifecycle/check", status_code=200)
def check_topic_lifecycle(db: Session = Depends(get_db)):
    """Check all active topics and transition to cooling if no activity in 30 days."""
    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(days=30)
    active_topics = db.query(Topic).filter(Topic.status == TopicStatus.active).all()
    transitioned = []
    for topic in active_topics:
        latest_node = (
            db.query(ArgumentNode)
            .filter(ArgumentNode.topic_id == topic.id)
            .order_by(ArgumentNode.created_at.desc())
            .first()
        )
        last_activity = latest_node.created_at if latest_node else topic.created_at
        if last_activity < cutoff:
            topic.status = TopicStatus.cooling
            transitioned.append(topic.id)
    db.commit()
    return {"checked": len(active_topics), "transitioned_to_cooling": transitioned}


# ── Discourse Tracks ──────────────────────────────────────────────────────────

@router.get("/{topic_id}/tracks", response_model=List[TrackOut])
def list_tracks(topic_id: str, db: Session = Depends(get_db)):
    tracks = db.query(DiscourseTrack).filter(DiscourseTrack.topic_id == topic_id).all()
    result = []
    for t in tracks:
        out = TrackOut.model_validate(t)
        out.node_count = db.query(ArgumentNode).filter(ArgumentNode.track_id == t.id).count()
        result.append(out)
    return result


@router.post("/{topic_id}/tracks", response_model=TrackOut, status_code=status.HTTP_201_CREATED)
def create_track(
    topic_id: str,
    payload: TrackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    track = DiscourseTrack(
        topic_id=topic_id,
        name=payload.name,
        description=payload.description,
        auto_detected=False,
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    out = TrackOut.model_validate(track)
    out.node_count = 0
    return out


# ── Briefing Room ─────────────────────────────────────────────────────────────

@router.get("/{topic_id}/briefing", response_model=BriefingData)
def get_briefing(topic_id: str, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    nodes = db.query(ArgumentNode).filter(ArgumentNode.topic_id == topic_id).order_by(ArgumentNode.created_at).all()
    tracks = db.query(DiscourseTrack).filter(DiscourseTrack.topic_id == topic_id).all()

    # Nodes with no children = unaddressed
    unaddressed = [n for n in nodes if not n.children]

    nodes_summary = [
        {"node_type": n.node_type.value, "content": n.content, "state": n.state.value}
        for n in nodes
    ]
    tracks_summary = [{"id": t.id, "name": t.name} for t in tracks]

    ai_data = ai_service.generate_briefing(topic.canonical_question, nodes_summary, tracks_summary)

    # Per-track summaries
    track_summaries = []
    for track in tracks:
        track_nodes = [n for n in nodes if n.track_id == track.id]
        track_summaries.append({
            "track_id": track.id,
            "track_name": track.name,
            "node_count": len(track_nodes),
            "unchallenged_count": sum(1 for n in track_nodes if n.state.value == "unchallenged"),
        })

    # Discourse health metrics
    total = len(nodes)
    sourced = sum(1 for n in nodes if n.sources)
    engaged = sum(1 for n in nodes if n.state.value != "unchallenged")

    health = {
        "total_nodes": total,
        "sourced_ratio": round(sourced / total, 2) if total else 0,
        "engagement_ratio": round(engaged / total, 2) if total else 0,
        "unaddressed_count": len(unaddressed),
        **ai_data.get("discourse_health", {}),
    }

    unaddressed_out = []
    for n in unaddressed[:5]:
        out = ArgumentNodeOut.model_validate(n)
        out.children_count = len(n.children)
        unaddressed_out.append(out)

    last_activity = max((n.updated_at for n in nodes), default=None) if nodes else None

    return BriefingData(
        summary=ai_data.get("summary", ""),
        key_positions=ai_data.get("key_positions", []),
        unaddressed_nodes=unaddressed_out,
        track_summaries=track_summaries,
        discourse_health=health,
        total_nodes=total,
        total_tracks=len(tracks),
        last_activity=last_activity,
        ai_powered=ai_data.get("ai_powered", False),
        main_areas_of_contention=ai_data.get("main_areas_of_contention", []),
        what_has_been_left_unaddressed=ai_data.get("what_has_been_left_unaddressed", ""),
    )


# ── Catch-Up Briefing ────────────────────────────────────────────────────────

@router.get("/{topic_id}/catch-up", response_model=CatchUpData)
def get_catch_up(
    topic_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    nodes = (
        db.query(ArgumentNode)
        .filter(ArgumentNode.topic_id == topic_id)
        .order_by(ArgumentNode.created_at)
        .all()
    )

    # Determine if the user is a newcomer (no prior arguments in this topic)
    is_newcomer = True
    if current_user:
        user_node_count = (
            db.query(ArgumentNode)
            .filter(ArgumentNode.topic_id == topic_id, ArgumentNode.author_id == current_user.id)
            .count()
        )
        is_newcomer = user_node_count == 0

    nodes_summary = [
        {"node_type": n.node_type.value, "content": n.content, "state": n.state.value}
        for n in nodes
    ]

    # Personalize based on user expertise if available
    user_expertise = None
    if current_user and current_user.is_verified_expert and current_user.expert_domain:
        user_expertise = current_user.expert_domain

    ai_data = ai_service.generate_catch_up(topic.canonical_question, nodes_summary, user_expertise)

    # Build contribution opportunities from AI suggestions and unaddressed nodes
    opportunities = []
    for sug in ai_data.get("contribution_suggestions", []):
        # Find a matching unaddressed node to link to
        matching_node = None
        for n in nodes:
            if not n.children and sug.get("suggestion", "").lower() in n.content.lower():
                matching_node = n
                break
        # Fall back to the first unaddressed node of the right type
        if not matching_node:
            for n in nodes:
                if not n.children:
                    matching_node = n
                    break
        opportunities.append(ContributionOpportunity(
            argument_id=matching_node.id if matching_node else "",
            content_snippet=matching_node.content[:120] if matching_node else "",
            opportunity_type=sug.get("opportunity_type", "gap"),
            suggestion=sug.get("suggestion", ""),
        ))

    # Count unique participants
    participant_ids = set(n.author_id for n in nodes)

    return CatchUpData(
        is_newcomer=is_newcomer,
        established_points=ai_data.get("established_points", []),
        refuted_points=ai_data.get("refuted_points", []),
        active_debates=ai_data.get("active_debates", []),
        contribution_opportunities=opportunities,
        summary=ai_data.get("summary", ""),
        total_nodes=len(nodes),
        total_participants=len(participant_ids),
        ai_powered=ai_data.get("ai_powered", False),
    )
