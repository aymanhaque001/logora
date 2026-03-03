import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey,
    Boolean, JSON, Enum as SAEnum, Float
)
from sqlalchemy.orm import relationship
from app.database import Base
import enum


def generate_id():
    return str(uuid.uuid4())


class TopicTag(str, enum.Enum):
    geographic = "geographic"
    social = "social"
    economic = "economic"
    scientific = "scientific"
    political = "political"
    environmental = "environmental"


class NodeType(str, enum.Enum):
    assertion = "assertion"          # Makes a positive claim
    counter = "counter"              # Directly challenges an assertion
    qualification = "qualification"  # "True, but only under condition X"
    exception = "exception"          # "This breaks down in case Y"
    synthesis = "synthesis"          # "Both sides agree on Z"
    reframe = "reframe"              # "The real question is actually..."
    open_question = "open_question"  # Raises something unaddressed
    concession = "concession"        # "I acknowledge point X is valid"


class NuanceTag(str, enum.Enum):
    temporal = "temporal"                       # "Was true before X, not now"
    geographic = "geographic"                   # "Applies to X region, not Y"
    scale = "scale"                             # "True at local level, reverses nationally"
    conditional = "conditional"                 # "Only holds if policy X is in place"
    population_specific = "population_specific" # "Applies to renters, not homeowners"
    contested_empirically = "contested_empirically"  # "Experts actively disagree"


class ArgumentState(str, enum.Enum):
    unchallenged = "unchallenged"   # No responses yet
    engaged = "engaged"             # Has at least one counter/qualification
    refined = "refined"             # Author updated claim after pushback
    branched = "branched"           # Spawned its own sub-debate
    merged = "merged"               # Same point as another node
    conceded = "conceded"           # Author acknowledged a valid counter
    dormant = "dormant"             # No activity in 30 days


class EdgeRelationship(str, enum.Enum):
    supports = "supports"
    challenges = "challenges"
    qualifies = "qualifies"
    refines = "refines"
    contradicts = "contradicts"
    synthesizes = "synthesizes"
    questions = "questions"


class TopicStatus(str, enum.Enum):
    active = "active"
    cooling = "cooling"     # No new claims in 30 days
    historical = "historical"  # Archived, read-only


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_id)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    credibility_score = Column(Float, default=50.0)  # 0-100
    is_verified_expert = Column(Boolean, default=False)
    expert_domain = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    topics = relationship("Topic", back_populates="creator")
    argument_nodes = relationship("ArgumentNode", back_populates="author")


class Topic(Base):
    __tablename__ = "topics"

    id = Column(String, primary_key=True, default=generate_id)
    canonical_question = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    tags = Column(JSON, default=list)           # List of TopicTag values
    location = Column(String, nullable=True)    # For geographic topics
    status = Column(SAEnum(TopicStatus), default=TopicStatus.active)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    source_url = Column(String, nullable=True)   # Original source (e.g. Reddit thread)
    node_count = Column(Float, default=0)        # Cached argument count
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = relationship("User", back_populates="topics")
    discourse_tracks = relationship("DiscourseTrack", back_populates="topic", cascade="all, delete-orphan")
    argument_nodes = relationship("ArgumentNode", back_populates="topic", cascade="all, delete-orphan")


class DiscourseTrack(Base):
    __tablename__ = "discourse_tracks"

    id = Column(String, primary_key=True, default=generate_id)
    topic_id = Column(String, ForeignKey("topics.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    auto_detected = Column(Boolean, default=False)  # True if AI created it
    created_at = Column(DateTime, default=datetime.utcnow)

    topic = relationship("Topic", back_populates="discourse_tracks")
    argument_nodes = relationship("ArgumentNode", back_populates="track")


class ArgumentNode(Base):
    __tablename__ = "argument_nodes"

    id = Column(String, primary_key=True, default=generate_id)
    topic_id = Column(String, ForeignKey("topics.id"), nullable=False)
    track_id = Column(String, ForeignKey("discourse_tracks.id"), nullable=True)
    parent_id = Column(String, ForeignKey("argument_nodes.id"), nullable=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)

    content = Column(Text, nullable=False)
    node_type = Column(SAEnum(NodeType), nullable=False)
    nuance_tags = Column(JSON, default=list)       # List of NuanceTag values
    sources = Column(JSON, default=list)           # List of source URLs/citations
    state = Column(SAEnum(ArgumentState), default=ArgumentState.unchallenged)

    # AI-generated metadata
    ai_classification_confidence = Column(Float, nullable=True)
    ai_suggested_track = Column(String, nullable=True)
    ai_summary = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    topic = relationship("Topic", back_populates="argument_nodes")
    track = relationship("DiscourseTrack", back_populates="argument_nodes")
    author = relationship("User", back_populates="argument_nodes")
    parent = relationship("ArgumentNode", remote_side="ArgumentNode.id", foreign_keys=[parent_id], overlaps="children")
    children = relationship("ArgumentNode", foreign_keys=[parent_id], overlaps="parent")

    outgoing_edges = relationship("ArgumentEdge", foreign_keys="ArgumentEdge.source_id", back_populates="source", cascade="all, delete-orphan")
    incoming_edges = relationship("ArgumentEdge", foreign_keys="ArgumentEdge.target_id", back_populates="target", cascade="all, delete-orphan")


class ArgumentEdge(Base):
    __tablename__ = "argument_edges"

    id = Column(String, primary_key=True, default=generate_id)
    source_id = Column(String, ForeignKey("argument_nodes.id"), nullable=False)
    target_id = Column(String, ForeignKey("argument_nodes.id"), nullable=False)
    relationship_type = Column(SAEnum(EdgeRelationship), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    source = relationship("ArgumentNode", foreign_keys=[source_id], back_populates="outgoing_edges")
    target = relationship("ArgumentNode", foreign_keys=[target_id], back_populates="incoming_edges")


# ── Cross-Topic Mesh Connections ───────────────────────────────────────────────

class TopicConnection(Base):
    """Links an argument node in one topic to an argument node in another topic,
    forming the rhizomatic mesh across debates."""
    __tablename__ = "topic_connections"

    id = Column(String, primary_key=True, default=generate_id)
    from_topic_id = Column(String, ForeignKey("topics.id"), nullable=False)
    to_topic_id = Column(String, ForeignKey("topics.id"), nullable=False)
    from_node_id = Column(String, ForeignKey("argument_nodes.id"), nullable=True)
    to_node_id = Column(String, ForeignKey("argument_nodes.id"), nullable=True)
    relationship_type = Column(String, default="related")  # related, extends, analogizes, challenges
    description = Column(String, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    from_topic = relationship("Topic", foreign_keys=[from_topic_id])
    to_topic = relationship("Topic", foreign_keys=[to_topic_id])
    from_node = relationship("ArgumentNode", foreign_keys=[from_node_id])
    to_node = relationship("ArgumentNode", foreign_keys=[to_node_id])
    creator = relationship("User", foreign_keys=[created_by])
