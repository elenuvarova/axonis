import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Float, ForeignKey, Text, Integer, Boolean
from database import Base


def _new_id() -> str:
    return str(uuid.uuid4())


class ResearchProject(Base):
    __tablename__ = "research_projects"

    id = Column(String(36), primary_key=True, default=_new_id)
    topic = Column(String(500), nullable=False)
    region = Column(String(100))
    goal = Column(String(200))
    # pending → building → ready | error
    status = Column(String(20), default="pending")
    error_message = Column(Text)
    # sha256 of the owner token handed to the creating browser; NULL for maps
    # made before tokens existed (those are read-only, see require_owner).
    owner_token_hash = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Entity(Base):
    __tablename__ = "entities"

    id = Column(String(36), primary_key=True, default=_new_id)
    project_id = Column(String(36), ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(500), nullable=False)
    # concept | organisation | person | paper | regulation | product | dataset | institution
    type = Column(String(50), nullable=False)
    description = Column(Text)
    # wikidata | openalex | upload | ai
    source = Column(String(50))
    source_url = Column(String(1000))
    confidence_score = Column(Float, default=1.0)
    wikidata_id = Column(String(100))
    openalex_id = Column(String(200))
    # graph metrics, written after build
    degree = Column(Float, default=0.0)
    betweenness = Column(Float, default=0.0)
    bridge_score = Column(Float, default=0.0)
    cluster_id = Column(String(10))


class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(String(36), primary_key=True, default=_new_id)
    project_id = Column(String(36), ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id = Column(String(36), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    target_id = Column(String(36), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    # related_to | subclass_of | part_of | has_part | publishes_on | funded_by | co_concept
    relation_type = Column(String(100), default="related_to")
    weight = Column(Float, default=1.0)
    evidence_source = Column(String(200))


class Cluster(Base):
    __tablename__ = "clusters"

    id = Column(String(36), primary_key=True, default=_new_id)
    project_id = Column(String(36), ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    # numeric string matching entity.cluster_id
    cluster_id = Column(String(10), nullable=False)
    name = Column(String(300))
    # short human label (ai/cluster_labeler.py); NULL on maps built before it
    label = Column(String(120))
    # JSON list of top entity names
    top_entities = Column(Text, default="[]")
    size = Column(Integer, default=0)
    # count of papers + institutions in cluster
    research_count = Column(Integer, default=0)
    product_count = Column(Integer, default=0)
    opportunity_score = Column(Float, default=0.0)
    avg_degree = Column(Float, default=0.0)
    max_bridge = Column(Float, default=0.0)


class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(String(36), primary_key=True, default=_new_id)
    project_id = Column(String(36), ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    cluster_db_id = Column(String(36), ForeignKey("clusters.id", ondelete="CASCADE"), index=True)
    title = Column(String(300))
    why_it_matters = Column(Text)
    # JSON arrays serialised as text
    risks = Column(Text, default="[]")
    next_questions = Column(Text, default="[]")
    evidence_strength = Column(Float, default=0.5)
    # low | medium | high
    risk_level = Column(String(20), default="medium")
    score = Column(Float, default=0.0)
    generated_by_ai = Column(Boolean, default=False)


class UsageCounter(Base):
    """Daily counts of LLM-backed actions (guard.spend): the service-wide
    budget has to survive deploys and restarts, so it lives here, not in
    process memory like the per-IP limits."""
    __tablename__ = "usage_counters"

    key = Column(String(80), primary_key=True)   # "ask" or "ask:<project id>"
    day = Column(String(10), primary_key=True)   # UTC date, YYYY-MM-DD
    count = Column(Integer, default=0, nullable=False)
