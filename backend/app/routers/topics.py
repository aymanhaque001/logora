from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import time
from app.database import get_db
from app.models import Topic, DiscourseTrack, ArgumentNode, ArgumentEdge, User, TopicConnection
from app.schemas import (
    TopicCreate, TopicUpdate, TopicOut, TrackCreate, TrackOut,
    BriefingData, CatchUpData, ContributionOpportunity, ArgumentNodeOut,
    TopicConnectionCreate, TopicConnectionOut, MeshGraphData, GraphNode, MeshGraphEdge,
)
from app.models import TopicStatus
from app.auth import get_current_user, get_optional_user
from app.services import ai_service
from app.services.credibility import award_credibility

router = APIRouter(prefix="/api/topics", tags=["topics"])

# Simple in-memory briefing cache — avoids redundant Claude calls.
# Keyed by topic_id, value is (timestamp, BriefingData).
_BRIEFING_CACHE: dict = {}
_BRIEFING_TTL = 10 * 60  # 10 minutes


def _enrich_topic(topic: Topic, db: Session) -> TopicOut:
    from sqlalchemy import func
    out = TopicOut.model_validate(topic)
    out.node_count = db.query(ArgumentNode).filter(ArgumentNode.topic_id == topic.id).count()
    out.track_count = db.query(DiscourseTrack).filter(DiscourseTrack.topic_id == topic.id).count()
    out.participant_count = db.query(
        func.count(func.distinct(ArgumentNode.author_id))
    ).filter(ArgumentNode.topic_id == topic.id).scalar() or 0
    last = db.query(func.max(ArgumentNode.created_at)).filter(
        ArgumentNode.topic_id == topic.id
    ).scalar()
    out.last_activity = last
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


# ── Cross-Topic Mesh ──────────────────────────────────────────────────────────────────

@router.get("/mesh", response_model=MeshGraphData)
def get_mesh_graph(
    topic_ids: str = Query(..., description="Comma-separated topic IDs"),
    db: Session = Depends(get_db),
):
    """Returns the combined argument graph for multiple topics, with cross-topic edges."""
    ids = [t.strip() for t in topic_ids.split(",") if t.strip()]
    if not ids:
        raise HTTPException(status_code=400, detail="topic_ids is required")

    all_nodes_out: List[GraphNode] = []
    for tid in ids:
        nodes = db.query(ArgumentNode).filter(ArgumentNode.topic_id == tid).all()
        tracks = db.query(DiscourseTrack).filter(DiscourseTrack.topic_id == tid).all()
        track_name_map = {t.id: t.name for t in tracks}
        for n in nodes:
            all_nodes_out.append(GraphNode(
                id=n.id,
                topic_id=n.topic_id,
                content=n.content,
                ai_summary=n.ai_summary,
                node_type=n.node_type,
                state=n.state,
                nuance_tags=n.nuance_tags or [],
                author_display_name=n.author.display_name,
                track_id=n.track_id,
                track_name=track_name_map.get(n.track_id) if n.track_id else None,
                sources_count=len(n.sources or []),
                children_count=len(n.children),
                created_at=n.created_at,
            ))

    all_edges_out: List[MeshGraphEdge] = []
    for tid in ids:
        edges = db.query(ArgumentEdge).join(
            ArgumentNode, ArgumentEdge.source_id == ArgumentNode.id
        ).filter(ArgumentNode.topic_id == tid).all()
        for e in edges:
            all_edges_out.append(MeshGraphEdge(
                id=e.id,
                source=e.source_id,
                target=e.target_id,
                relationship_type=e.relationship_type.value,
                is_cross_topic=False,
            ))

    node_ids = {n.id for n in all_nodes_out}
    for tid in ids:
        conns = db.query(TopicConnection).filter(
            (TopicConnection.from_topic_id == tid) | (TopicConnection.to_topic_id == tid)
        ).all()
        for conn in conns:
            if conn.from_node_id in node_ids and conn.to_node_id in node_ids:
                all_edges_out.append(MeshGraphEdge(
                    id=f"mesh_{conn.id}",
                    source=conn.from_node_id,
                    target=conn.to_node_id,
                    relationship_type=conn.relationship_type,
                    is_cross_topic=True,
                ))

    topics = db.query(Topic).filter(Topic.id.in_(ids)).all()
    topic_labels = {t.id: t.canonical_question[:45] for t in topics}

    return MeshGraphData(nodes=all_nodes_out, edges=all_edges_out, topic_labels=topic_labels)


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
    # Return cached result if still fresh
    cached = _BRIEFING_CACHE.get(topic_id)
    if cached and (time.time() - cached[0]) < _BRIEFING_TTL:
        return cached[1]

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

    result = BriefingData(
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

    # Store in cache
    _BRIEFING_CACHE[topic_id] = (time.time(), result)
    return result


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
    # Pre-categorize unaddressed nodes for better matching
    unaddressed = [n for n in nodes if not n.children]
    unchallenged_nodes = [n for n in unaddressed if n.state.value == "unchallenged"]
    question_nodes = [n for n in unaddressed if n.node_type.value == "open_question"]

    for sug in ai_data.get("contribution_suggestions", []):
        opp_type = sug.get("opportunity_type", "gap")
        # Match node based on opportunity type
        matching_node = None
        if opp_type == "unanswered_question" and question_nodes:
            matching_node = question_nodes.pop(0)
        elif opp_type == "unchallenged_claim" and unchallenged_nodes:
            matching_node = unchallenged_nodes.pop(0)
        elif unaddressed:
            matching_node = unaddressed.pop(0)

        opportunities.append(ContributionOpportunity(
            argument_id=matching_node.id if matching_node else None,
            content_snippet=matching_node.content[:120] if matching_node else "",
            opportunity_type=opp_type,
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


# ── Topic Connections (Mesh) ───────────────────────────────────────────────────

@router.get("/{topic_id}/connections", response_model=List[TopicConnectionOut])
def list_connections(topic_id: str, db: Session = Depends(get_db)):
    """List all cross-topic connections for a debate (both outgoing and incoming)."""
    conns = db.query(TopicConnection).filter(
        (TopicConnection.from_topic_id == topic_id) | (TopicConnection.to_topic_id == topic_id)
    ).all()
    result = []
    for c in conns:
        result.append(TopicConnectionOut(
            id=c.id,
            from_topic_id=c.from_topic_id,
            to_topic_id=c.to_topic_id,
            from_node_id=c.from_node_id,
            to_node_id=c.to_node_id,
            relationship_type=c.relationship_type,
            description=c.description,
            created_by=c.created_by,
            created_at=c.created_at,
            from_topic_question=c.from_topic.canonical_question if c.from_topic else "",
            to_topic_question=c.to_topic.canonical_question if c.to_topic else "",
        ))
    return result


@router.post("/{topic_id}/connections", response_model=TopicConnectionOut, status_code=201)
def create_connection(
    topic_id: str,
    payload: TopicConnectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Link an argument in this debate to an argument in another debate."""
    if payload.to_topic_id == topic_id:
        raise HTTPException(status_code=400, detail="Cannot link a topic to itself")
    to_topic = db.query(Topic).filter(Topic.id == payload.to_topic_id).first()
    if not to_topic:
        raise HTTPException(status_code=404, detail="Target topic not found")
    conn = TopicConnection(
        from_topic_id=topic_id,
        to_topic_id=payload.to_topic_id,
        from_node_id=payload.from_node_id,
        to_node_id=payload.to_node_id,
        relationship_type=payload.relationship_type,
        description=payload.description,
        created_by=current_user.id,
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return TopicConnectionOut(
        id=conn.id,
        from_topic_id=conn.from_topic_id,
        to_topic_id=conn.to_topic_id,
        from_node_id=conn.from_node_id,
        to_node_id=conn.to_node_id,
        relationship_type=conn.relationship_type,
        description=conn.description,
        created_by=conn.created_by,
        created_at=conn.created_at,
        from_topic_question=conn.from_topic.canonical_question if conn.from_topic else "",
        to_topic_question=conn.to_topic.canonical_question if conn.to_topic else "",
    )


@router.delete("/{topic_id}/connections/{conn_id}", status_code=204)
def delete_connection(
    topic_id: str,
    conn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = db.query(TopicConnection).filter(
        TopicConnection.id == conn_id,
        TopicConnection.from_topic_id == topic_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    if conn.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can remove this connection")
    db.delete(conn)
    db.commit()
    return None
