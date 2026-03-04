from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import (
    ArgumentNode, ArgumentEdge, DiscourseTrack, Topic, User,
    ArgumentState, NodeType
)
from app.schemas import ArgumentCreate, ArgumentUpdate, ArgumentNodeOut, EdgeOut, GraphData, GraphNode, GraphEdge, StateTransition
from app.auth import get_current_user
from app.services import ai_service
from app.services.credibility import award_credibility
from app.services import vector_store as vs
from app.services import graph_rag

router = APIRouter(prefix="/api/topics/{topic_id}/arguments", tags=["arguments"])


def _update_parent_state(parent: ArgumentNode, child: ArgumentNode, db: Session):
    """Auto-transition parent state based on new child."""
    # unchallenged → engaged on first response
    if parent.state == ArgumentState.unchallenged:
        parent.state = ArgumentState.engaged
    # dormant → engaged when re-engaged
    elif parent.state == ArgumentState.dormant:
        parent.state = ArgumentState.engaged

    # Auto-detect branched: 3+ children from 2+ distinct authors
    if parent.state == ArgumentState.engaged:
        children = parent.children
        if len(children) >= 3:
            distinct_authors = {c.author_id for c in children}
            if len(distinct_authors) >= 2:
                parent.state = ArgumentState.branched

    db.commit()


def _get_or_create_track(topic_id: str, track_name: str, db: Session) -> DiscourseTrack:
    existing = db.query(DiscourseTrack).filter(
        DiscourseTrack.topic_id == topic_id,
        DiscourseTrack.name == track_name,
    ).first()
    if existing:
        return existing

    track = DiscourseTrack(
        topic_id=topic_id,
        name=track_name,
        auto_detected=True,
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    return track


@router.get("", response_model=List[ArgumentNodeOut])
def list_arguments(topic_id: str, track_id: str = None, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    q = db.query(ArgumentNode).filter(ArgumentNode.topic_id == topic_id)
    if track_id:
        q = q.filter(ArgumentNode.track_id == track_id)

    nodes = q.order_by(ArgumentNode.created_at).all()
    result = []
    for n in nodes:
        out = ArgumentNodeOut.model_validate(n)
        out.children_count = len(n.children)
        result.append(out)
    return result


@router.post("", response_model=ArgumentNodeOut, status_code=status.HTTP_201_CREATED)
def submit_argument(
    topic_id: str,
    payload: ArgumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Validate parent if provided
    parent = None
    if payload.parent_id:
        parent = db.query(ArgumentNode).filter(ArgumentNode.id == payload.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent argument not found")
        if not payload.edge_relationship:
            raise HTTPException(status_code=400, detail="edge_relationship is required when responding to an argument")

    # AI classification — give Claude full topic context for better track theme suggestions
    parent_content = parent.content if parent else None
    existing_tracks = db.query(DiscourseTrack).filter(
        DiscourseTrack.topic_id == topic_id
    ).all()
    existing_track_names = [t.name for t in existing_tracks]

    ai_result = ai_service.classify_node(
        payload.content,
        parent_content,
        payload.node_type.value,
        topic_question=topic.canonical_question,
        existing_track_names=existing_track_names,
    )

    # Resolve discourse track
    track_id = payload.track_id

    if not track_id:
        # Try AI track detection
        tracks_data = [{"id": t.id, "name": t.name, "description": t.description} for t in existing_tracks]

        detected_track_id = ai_service.detect_track_for_node(payload.content, tracks_data)

        if detected_track_id:
            track_id = detected_track_id
        elif ai_result.get("suggested_track_theme") and ai_result["suggested_track_theme"] != "General":
            # Auto-create a new track based on AI suggestion
            new_track = _get_or_create_track(topic_id, ai_result["suggested_track_theme"], db)
            track_id = new_track.id

    # Merge nuance tags from payload and AI suggestion
    nuance_tags = list(set(
        [t.value for t in payload.nuance_tags] +
        ai_result.get("nuance_tags", [])
    ))

    node = ArgumentNode(
        topic_id=topic_id,
        track_id=track_id,
        parent_id=payload.parent_id,
        author_id=current_user.id,
        content=payload.content,
        node_type=payload.node_type,
        nuance_tags=nuance_tags,
        sources=[s.model_dump() for s in payload.sources],
        ai_classification_confidence=ai_result.get("confidence"),
        ai_suggested_track=ai_result.get("suggested_track_theme"),
    )
    db.add(node)
    db.flush()  # Get node.id before creating the edge

    # Create edge if this is a response
    if parent and payload.edge_relationship:
        edge = ArgumentEdge(
            source_id=node.id,
            target_id=parent.id,
            relationship_type=payload.edge_relationship,
        )
        db.add(edge)
        _update_parent_state(parent, node, db)

    db.commit()
    db.refresh(node)

    # Generate a concept summary for knowledge-graph display
    node_type_val = node.node_type.value if hasattr(node.node_type, 'value') else str(node.node_type)
    ai_summary = ai_service.summarize_node(node.content, node_type_val)
    if ai_summary:
        node.ai_summary = ai_summary
        db.commit()
        db.refresh(node)

    # Index in vector store for Graph RAG
    vs.add_argument(
        argument_id=node.id,
        content=node.content,
        topic_id=topic_id,
        node_type=node.node_type.value if hasattr(node.node_type, 'value') else node.node_type,
        track_id=node.track_id,
        author_id=node.author_id,
        author_display_name=current_user.display_name,
        parent_id=node.parent_id,
    )

    out = ArgumentNodeOut.model_validate(node)
    out.children_count = 0

    # Award credibility for submitting a sourced argument
    award_credibility(current_user, "submit_argument", has_sources=len(payload.sources) > 0, db=db)

    return out


@router.get("/graph", response_model=GraphData)
def get_graph(topic_id: str, db: Session = Depends(get_db)):
    """Returns all nodes and edges formatted for React Flow graph visualization."""
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    nodes = db.query(ArgumentNode).filter(ArgumentNode.topic_id == topic_id).all()
    edges = db.query(ArgumentEdge).join(
        ArgumentNode, ArgumentEdge.source_id == ArgumentNode.id
    ).filter(ArgumentNode.topic_id == topic_id).all()

    # Build a track name lookup
    tracks = db.query(DiscourseTrack).filter(DiscourseTrack.topic_id == topic_id).all()
    track_name_map = {t.id: t.name for t in tracks}

    graph_nodes = [
        GraphNode(
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
        )
        for n in nodes
    ]

    graph_edges = [
        GraphEdge(
            id=e.id,
            source=e.source_id,
            target=e.target_id,
            relationship_type=e.relationship_type,
        )
        for e in edges
    ]

    return GraphData(nodes=graph_nodes, edges=graph_edges)


# ── Edit / Delete / State Transitions ───────────────────────────────────────

@router.patch("/{argument_id}", response_model=ArgumentNodeOut)
def update_argument(
    topic_id: str,
    argument_id: str,
    payload: ArgumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = db.query(ArgumentNode).filter(
        ArgumentNode.id == argument_id,
        ArgumentNode.topic_id == topic_id,
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail="Argument not found")
    if node.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author can edit this argument")

    update_data = payload.model_dump(exclude_unset=True)
    if "content" in update_data and update_data["content"]:
        node.content = update_data["content"]
        # Auto-transition to refined if the argument was engaged (author revised after pushback)
        if node.state == ArgumentState.engaged:
            node.state = ArgumentState.refined
        # Re-generate AI summary on content change
        ai_summary = ai_service.summarize_node(node.content)
        if ai_summary:
            node.ai_summary = ai_summary
    if "nuance_tags" in update_data:
        node.nuance_tags = [t.value for t in update_data["nuance_tags"]] if update_data["nuance_tags"] else []
    if "sources" in update_data:
        node.sources = [s.model_dump() for s in update_data["sources"]] if update_data["sources"] else []

    db.commit()
    db.refresh(node)
    out = ArgumentNodeOut.model_validate(node)
    out.children_count = len(node.children)
    return out


@router.delete("/{argument_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_argument(
    topic_id: str,
    argument_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = db.query(ArgumentNode).filter(
        ArgumentNode.id == argument_id,
        ArgumentNode.topic_id == topic_id,
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail="Argument not found")
    if node.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author can delete this argument")
    if len(node.children) > 0:
        raise HTTPException(status_code=400, detail="Cannot delete an argument with responses. Consider conceding instead.")

    # Remove edges
    db.query(ArgumentEdge).filter(
        (ArgumentEdge.source_id == argument_id) | (ArgumentEdge.target_id == argument_id)
    ).delete(synchronize_session=False)

    db.delete(node)
    db.commit()
    return None


# Valid state transitions (current_state -> allowed_new_states)
_VALID_TRANSITIONS = {
    ArgumentState.unchallenged: {ArgumentState.conceded, ArgumentState.dormant},
    ArgumentState.engaged: {ArgumentState.refined, ArgumentState.branched, ArgumentState.merged, ArgumentState.conceded, ArgumentState.dormant},
    ArgumentState.refined: {ArgumentState.engaged, ArgumentState.conceded, ArgumentState.dormant},
    ArgumentState.branched: {ArgumentState.engaged, ArgumentState.merged, ArgumentState.dormant},
    ArgumentState.merged: set(),  # terminal state
    ArgumentState.conceded: set(),  # terminal state
    ArgumentState.dormant: {ArgumentState.engaged},  # can be re-engaged
}

# Some transitions only the author can perform
_AUTHOR_ONLY_STATES = {ArgumentState.conceded, ArgumentState.refined}
# Some transitions any authenticated user can trigger
_ANY_USER_STATES = {ArgumentState.branched, ArgumentState.merged, ArgumentState.engaged}

# Human-readable descriptions for each transition
_TRANSITION_DESCRIPTIONS = {
    ArgumentState.conceded: "Acknowledge a valid counter-argument. Awards credibility for intellectual honesty.",
    ArgumentState.refined: "You revised this argument after receiving pushback.",
    ArgumentState.branched: "This argument has spawned its own sub-debate with multiple threads.",
    ArgumentState.merged: "This argument makes the same point as another — merging them.",
    ArgumentState.engaged: "This argument has active responses and debate.",
    ArgumentState.dormant: "No activity on this argument in 30 days.",
}


@router.post("/{argument_id}/transition", response_model=ArgumentNodeOut)
def transition_state(
    topic_id: str,
    argument_id: str,
    payload: StateTransition,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Transition an argument's state. Only the author can concede/refine their own argument."""
    node = db.query(ArgumentNode).filter(
        ArgumentNode.id == argument_id,
        ArgumentNode.topic_id == topic_id,
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail="Argument not found")

    # Author-only transitions
    if payload.new_state in _AUTHOR_ONLY_STATES and node.author_id != current_user.id:
        raise HTTPException(status_code=403, detail=f"Only the author can transition to '{payload.new_state.value}'")

    # Validate the transition is allowed
    allowed = _VALID_TRANSITIONS.get(node.state, set())
    if payload.new_state not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{node.state.value}' to '{payload.new_state.value}'. "
                   f"Allowed: {[s.value for s in allowed]}."
        )

    old_state = node.state
    node.state = payload.new_state
    db.commit()
    db.refresh(node)

    # Award credibility for conceding (intellectual honesty)
    if payload.new_state == ArgumentState.conceded:
        award_credibility(current_user, "concede", db=db)
        # Also award credibility to the person being conceded to (parent author)
        if node.parent_id:
            parent = db.query(ArgumentNode).filter(ArgumentNode.id == node.parent_id).first()
            if parent and parent.author_id != current_user.id:
                parent_author = db.query(User).filter(User.id == parent.author_id).first()
                if parent_author:
                    award_credibility(parent_author, "conceded_to", db=db)

    out = ArgumentNodeOut.model_validate(node)
    out.children_count = len(node.children)
    return out


@router.get("/{argument_id}/transitions")
def get_available_transitions(
    topic_id: str,
    argument_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return which state transitions are available for this argument for the current user."""
    node = db.query(ArgumentNode).filter(
        ArgumentNode.id == argument_id,
        ArgumentNode.topic_id == topic_id,
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail="Argument not found")

    allowed = _VALID_TRANSITIONS.get(node.state, set())
    is_author = node.author_id == current_user.id

    transitions = []
    for state in allowed:
        # Filter based on permissions
        if state in _AUTHOR_ONLY_STATES and not is_author:
            continue
        transitions.append({
            "state": state.value,
            "label": state.value.replace("_", " ").title(),
            "description": _TRANSITION_DESCRIPTIONS.get(state, ""),
            "author_only": state in _AUTHOR_ONLY_STATES,
        })

    return {
        "current_state": node.state.value,
        "is_author": is_author,
        "transitions": transitions,
    }


@router.post("/lifecycle/dormant", status_code=200)
def check_dormant_arguments(topic_id: str, db: Session = Depends(get_db)):
    """Mark arguments with no activity in 30 days as dormant."""
    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(days=30)
    active_states = [ArgumentState.unchallenged, ArgumentState.engaged, ArgumentState.refined, ArgumentState.branched]
    nodes = db.query(ArgumentNode).filter(
        ArgumentNode.topic_id == topic_id,
        ArgumentNode.state.in_(active_states),
        ArgumentNode.updated_at < cutoff,
    ).all()
    transitioned_ids = []
    for node in nodes:
        # Only mark dormant if no children were added recently
        recent_child = any(c.created_at > cutoff for c in node.children)
        if not recent_child:
            node.state = ArgumentState.dormant
            transitioned_ids.append(node.id)
    db.commit()
    return {"checked": len(nodes), "transitioned_to_dormant": transitioned_ids}


# ── Pre-Classification ───────────────────────────────────────────────────────

@router.post("/pre-classify")
def pre_classify_node(
    topic_id: str,
    payload: dict,
):
    """
    Lightweight AI pre-classification: given draft content return the most
    likely node type. No DB writes. No auth required.
    Body: { "content": "...", "parent_content": "..." (optional) }
    Returns: { "suggested_type": NodeType, "confidence": float, "reasoning": str }
    """
    content = payload.get("content", "").strip()
    parent_content = payload.get("parent_content", "").strip() or None
    if not content:
        raise HTTPException(status_code=400, detail="content is required")

    result = ai_service.classify_node(content, parent_content, "assertion")
    return {
        "suggested_type": result.get("confirmed_type", "assertion"),
        "confidence": result.get("confidence", 0.75),
        "reasoning": result.get("reasoning", ""),
    }


# ── Duplicate Detection (Graph RAG) ──────────────────────────────────────────

@router.post("/check-duplicate")
def check_duplicate(
    topic_id: str,
    payload: dict,
    db: Session = Depends(get_db),
):
    """
    Check if an argument is a duplicate before submission.
    Uses vector search + graph expansion + Claude reasoning.
    Body: { "content": "..." }
    """
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    content = payload.get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="content is required")

    if not vs.is_available():
        return {
            "is_duplicate": False,
            "confidence": 0.0,
            "similar_arguments": [],
            "explanation": "Vector store not available. Duplicate detection disabled.",
            "suggestion": None,
            "ai_powered": False,
        }

    result = graph_rag.check_duplicate(content, topic_id, db)
    return result


# ── RAG Query ─────────────────────────────────────────────────────────────────

@router.post("/rag-query")
def rag_query(
    topic_id: str,
    payload: dict,
    db: Session = Depends(get_db),
):
    """
    Graph RAG-powered question answering about a specific debate.
    Body: { "query": "What evidence supports X?", "author_id": "<optional uuid>" }
    """
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    query = payload.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")

    author_id = payload.get("author_id") or None

    result = graph_rag.rag_briefing(
        topic_question=topic.canonical_question,
        query=query,
        topic_id=topic_id,
        db=db,
        author_id=author_id,
    )
    return result


# ── Vector Store Management ───────────────────────────────────────────────────

@router.post("/backfill-vectors")
def backfill_vectors(
    topic_id: str,
    db: Session = Depends(get_db),
):
    """Backfill all arguments for this topic into the vector store."""
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    count = vs.backfill_from_db(db)
    return {"backfilled": count, "vector_store_status": vs.get_status()}


# ── Batch Summarize ───────────────────────────────────────────────────────────

@router.post("/batch-summarize")
def batch_summarize(
    topic_id: str,
    db: Session = Depends(get_db),
):
    """
    Generate / regenerate AI concept summaries for all nodes in this topic
    that lack a proper summary. Uses a batched Claude call to keep cost minimal.
    """
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    if not ai_service.is_available():
        return {"updated": 0, "message": "AI not available — set ANTHROPIC_API_KEY in backend/.env"}

    nodes = db.query(ArgumentNode).filter(ArgumentNode.topic_id == topic_id).all()

    # Heuristic: a "real" summary is shorter than the content and doesn't
    # just mirror its start.
    def needs_summary(n: ArgumentNode) -> bool:
        if not n.ai_summary:
            return True
        # If the summary is just the first chars of content, it's a truncated raw copy
        return n.content.strip().startswith(n.ai_summary.rstrip('\u2026').strip()[:60])

    pending = [
        {
            "id": n.id,
            "content": n.content,
            "node_type": n.node_type.value if hasattr(n.node_type, 'value') else str(n.node_type),
        }
        for n in nodes
        if needs_summary(n)
    ]

    if not pending:
        return {"updated": 0, "message": "All nodes already have summaries"}

    updated = 0
    # Process in batches of 30
    batch_size = 30
    for i in range(0, len(pending), batch_size):
        batch = pending[i:i + batch_size]
        summaries = ai_service.batch_summarize_nodes(batch)
        for node_id, summary in summaries.items():
            db.query(ArgumentNode).filter(ArgumentNode.id == node_id).update(
                {"ai_summary": summary}
            )
            updated += 1
        db.commit()

    return {
        "updated": updated,
        "total_nodes": len(nodes),
        "message": f"Generated concept summaries for {updated} nodes",
    }
