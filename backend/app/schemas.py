from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
from app.models import TopicTag, NodeType, NuanceTag, ArgumentState, EdgeRelationship, TopicStatus


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    username: str
    display_name: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    username: str
    display_name: str
    credibility_score: float
    is_verified_expert: bool
    expert_domain: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Topics ────────────────────────────────────────────────────────────────────

class TopicCreate(BaseModel):
    canonical_question: str
    description: Optional[str] = None
    tags: List[TopicTag] = []
    location: Optional[str] = None

    @field_validator("canonical_question")
    @classmethod
    def question_must_end_with_mark(cls, v: str) -> str:
        v = v.strip()
        if not v.endswith("?"):
            v += "?"
        return v


class TopicUpdate(BaseModel):
    canonical_question: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[TopicTag]] = None
    location: Optional[str] = None

    @field_validator("canonical_question")
    @classmethod
    def question_must_end_with_mark(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v.endswith("?"):
            v += "?"
        return v


class TopicOut(BaseModel):
    id: str
    canonical_question: str
    description: Optional[str]
    tags: List[str]
    location: Optional[str]
    status: TopicStatus
    created_by: str
    created_at: datetime
    creator: UserOut
    node_count: int = 0
    track_count: int = 0
    participant_count: int = 0
    last_activity: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Discourse Tracks ──────────────────────────────────────────────────────────

class TrackCreate(BaseModel):
    name: str
    description: Optional[str] = None


class TrackOut(BaseModel):
    id: str
    topic_id: str
    name: str
    description: Optional[str]
    auto_detected: bool
    created_at: datetime
    node_count: int = 0

    class Config:
        from_attributes = True


# ── Argument Nodes ────────────────────────────────────────────────────────────

class SourceItem(BaseModel):
    url: Optional[str] = None
    title: str
    description: Optional[str] = None
    source_type: str = "article"  # article, academic, government, data, other


class ArgumentCreate(BaseModel):
    content: str
    node_type: NodeType
    sources: List[SourceItem] = []
    nuance_tags: List[NuanceTag] = []
    parent_id: Optional[str] = None
    track_id: Optional[str] = None
    edge_relationship: Optional[EdgeRelationship] = None  # Required when parent_id is set

    @field_validator("content")
    @classmethod
    def content_min_length(cls, v: str) -> str:
        if len(v.strip()) < 20:
            raise ValueError("Argument must be at least 20 characters")
        return v.strip()


class ArgumentUpdate(BaseModel):
    content: Optional[str] = None
    nuance_tags: Optional[List[NuanceTag]] = None
    sources: Optional[List[SourceItem]] = None

    @field_validator("content")
    @classmethod
    def content_min_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.strip()) < 20:
            raise ValueError("Argument must be at least 20 characters")
        return v.strip() if v else v


class StateTransition(BaseModel):
    new_state: ArgumentState
    reason: Optional[str] = None



class ArgumentNodeOut(BaseModel):
    id: str
    topic_id: str
    track_id: Optional[str]
    parent_id: Optional[str]
    author_id: str
    content: str
    node_type: NodeType
    nuance_tags: List[str]
    sources: List[dict]
    state: ArgumentState
    ai_classification_confidence: Optional[float]
    ai_suggested_track: Optional[str]
    ai_summary: Optional[str]
    created_at: datetime
    updated_at: datetime
    author: UserOut
    children_count: int = 0

    @field_validator('sources', mode='before')
    @classmethod
    def coerce_sources(cls, v):
        if not isinstance(v, list):
            return []
        result = []
        for item in v:
            if isinstance(item, dict):
                result.append(item)
            elif isinstance(item, str):
                result.append({'title': item, 'url': item, 'source_type': 'article'})
        return result

    class Config:
        from_attributes = True


# ── Argument Edges ────────────────────────────────────────────────────────────

class EdgeOut(BaseModel):
    id: str
    source_id: str
    target_id: str
    relationship_type: EdgeRelationship
    created_at: datetime

    class Config:
        from_attributes = True


# ── Graph Data (for visualization) ───────────────────────────────────────────

class GraphNode(BaseModel):
    id: str
    topic_id: str
    content: str
    ai_summary: Optional[str] = None
    node_type: NodeType
    state: ArgumentState
    nuance_tags: List[str]
    author_display_name: str
    track_id: Optional[str]
    track_name: Optional[str]
    sources_count: int
    children_count: int
    created_at: datetime


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relationship_type: EdgeRelationship


class GraphData(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


# ── Briefing Room ─────────────────────────────────────────────────────────────

class BriefingData(BaseModel):
    summary: str
    key_positions: List[dict]
    unaddressed_nodes: List[ArgumentNodeOut]
    track_summaries: List[dict]
    discourse_health: dict
    total_nodes: int
    total_tracks: int
    last_activity: Optional[datetime]
    ai_powered: bool = False
    main_areas_of_contention: List[str] = []
    what_has_been_left_unaddressed: str = ""


# ── Catch-Up Briefing ────────────────────────────────────────────────────────

class ContributionOpportunity(BaseModel):
    argument_id: Optional[str]
    content_snippet: str
    opportunity_type: str  # "gap", "unchallenged_claim", "unanswered_question"
    suggestion: str


class CatchUpData(BaseModel):
    is_newcomer: bool
    established_points: List[dict]   # High-credibility, unchallenged arguments
    refuted_points: List[dict]       # Arguments with successful rebuttals
    active_debates: List[dict]       # Contested branches with recent activity
    contribution_opportunities: List[ContributionOpportunity]
    summary: str
    total_nodes: int
    total_participants: int
    ai_powered: bool = False


# ── Cross-Topic Mesh ─────────────────────────────────────────────────────────

class TopicConnectionCreate(BaseModel):
    to_topic_id: str
    from_node_id: Optional[str] = None
    to_node_id: Optional[str] = None
    relationship_type: str = "related"
    description: Optional[str] = None


class TopicConnectionOut(BaseModel):
    id: str
    from_topic_id: str
    to_topic_id: str
    from_node_id: Optional[str]
    to_node_id: Optional[str]
    relationship_type: str
    description: Optional[str]
    created_by: str
    created_at: datetime
    from_topic_question: str
    to_topic_question: str

    class Config:
        from_attributes = True


class MeshGraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relationship_type: str
    is_cross_topic: bool = False


class MeshGraphData(BaseModel):
    nodes: List[GraphNode]
    edges: List[MeshGraphEdge]
    topic_labels: dict  # topic_id -> short label
