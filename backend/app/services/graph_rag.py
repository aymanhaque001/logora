"""
Graph RAG service — hybrid retrieval combining vector search with graph expansion.

Pipeline:
1. Vector Search: Find semantically similar arguments via ChromaDB
2. Graph Expansion: Walk the argument graph (parent chains, rebuttals, concessions)
   to pull in structurally related context that pure vector search misses
3. Context Assembly: Merge and deduplicate into a rich context window
4. LLM Reasoning: Send to Claude for analysis (duplicate detection, briefings, etc.)
"""
import json
import sys
from typing import Optional
from sqlalchemy.orm import Session

from app.models import ArgumentNode, ArgumentEdge, DiscourseTrack, EdgeRelationship
from app.services import vector_store


def _expand_graph(
    seed_ids: list[str],
    db: Session,
    max_hops: int = 2,
    max_nodes: int = 30,
) -> list[dict]:
    """
    Walk the argument graph starting from seed nodes.
    Follows parent_id links, edges (supports, challenges, qualifies, etc.).
    Returns expanded context as a list of argument dicts.
    """
    visited = set()
    frontier = set(seed_ids)
    result = []

    for hop in range(max_hops + 1):
        if not frontier or len(result) >= max_nodes:
            break

        # Fetch nodes in this frontier
        nodes = db.query(ArgumentNode).filter(
            ArgumentNode.id.in_(list(frontier))
        ).all()

        next_frontier = set()
        for node in nodes:
            if node.id in visited:
                continue
            visited.add(node.id)

            result.append({
                "id": node.id,
                "content": node.content,
                "node_type": node.node_type.value if hasattr(node.node_type, 'value') else node.node_type,
                "state": node.state.value if hasattr(node.state, 'value') else node.state,
                "parent_id": node.parent_id,
                "track_id": node.track_id,
                "ai_summary": node.ai_summary,
                "sources_count": len(node.sources) if node.sources else 0,
                "hop": hop,
            })

            if len(result) >= max_nodes:
                break

            # Explore neighbours (only in subsequent hops)
            if hop < max_hops:
                # Parent
                if node.parent_id and node.parent_id not in visited:
                    next_frontier.add(node.parent_id)

                # Children
                children = db.query(ArgumentNode.id).filter(
                    ArgumentNode.parent_id == node.id
                ).all()
                for (child_id,) in children:
                    if child_id not in visited:
                        next_frontier.add(child_id)

                # Edge neighbours (both directions)
                outgoing = db.query(ArgumentEdge).filter(
                    ArgumentEdge.source_id == node.id
                ).all()
                for edge in outgoing:
                    if edge.target_id not in visited:
                        next_frontier.add(edge.target_id)

                incoming = db.query(ArgumentEdge).filter(
                    ArgumentEdge.target_id == node.id
                ).all()
                for edge in incoming:
                    if edge.source_id not in visited:
                        next_frontier.add(edge.source_id)

        frontier = next_frontier - visited

    return result


def retrieve_context(
    query: str,
    topic_id: str,
    db: Session,
    n_vector_results: int = 8,
    max_graph_hops: int = 2,
    max_total_nodes: int = 25,
    exclude_ids: Optional[list[str]] = None,
    author_id: Optional[str] = None,
) -> dict:
    """
    Hybrid retrieval: vector search → graph expansion → deduplicated context.
    When author_id is provided, also fetches all arguments by that author directly
    (bypassing semantic similarity so author-specific queries always find their content).
    Returns {vector_hits, graph_expanded, merged_context, stats}.
    """
    # Step 1a: Semantic vector search (optionally filtered by author)
    vector_hits = vector_store.search_similar(
        query=query,
        topic_id=topic_id,
        author_id=author_id,
        n_results=n_vector_results,
        exclude_ids=exclude_ids,
    )

    # Step 1b: If author_id given, also pull ALL their arguments directly
    # (semantic search might miss them if the query phrasing differs)
    author_hits: list[dict] = []
    if author_id:
        author_hits = vector_store.get_by_author(
            author_id=author_id,
            topic_id=topic_id,
            limit=40,
        )

    seed_ids = [h["id"] for h in vector_hits]

    # Merge author_hits into seed set (deduplicated)
    author_hit_ids = {h["id"] for h in vector_hits}
    for hit in author_hits:
        if hit["id"] not in author_hit_ids:
            author_hit_ids.add(hit["id"])
            vector_hits.append(hit)
            seed_ids.append(hit["id"])

    # Step 2: Graph expansion from vector seeds
    graph_nodes = []
    if seed_ids:
        graph_nodes = _expand_graph(
            seed_ids=seed_ids,
            db=db,
            max_hops=max_graph_hops,
            max_nodes=max_total_nodes,
        )

    # Step 3: Merge and deduplicate
    seen_ids = set()
    merged = []

    # Vector hits first (with similarity scores)
    for hit in vector_hits:
        if hit["id"] not in seen_ids:
            seen_ids.add(hit["id"])
            merged.append({
                "id": hit["id"],
                "content": hit["content"],
                "similarity": hit["similarity"],
                "source": "vector",
                **hit.get("metadata", {}),
            })

    # Graph-expanded nodes
    for node in graph_nodes:
        if node["id"] not in seen_ids:
            seen_ids.add(node["id"])
            merged.append({
                "id": node["id"],
                "content": node["content"],
                "node_type": node["node_type"],
                "state": node["state"],
                "ai_summary": node.get("ai_summary"),
                "hop": node["hop"],
                "source": "graph",
            })

    return {
        "vector_hits": vector_hits,
        "graph_expanded": graph_nodes,
        "merged_context": merged,
        "stats": {
            "vector_count": len(vector_hits),
            "graph_count": len(graph_nodes),
            "merged_count": len(merged),
            "unique_from_graph": len(merged) - len(vector_hits),
        },
    }


def check_duplicate(
    content: str,
    topic_id: str,
    db: Session,
    similarity_threshold: float = 0.75,
) -> dict:
    """
    Check if a new argument is a duplicate of existing ones.
    Uses vector search + graph expansion + Claude reasoning.

    Returns {is_duplicate, confidence, similar_arguments, explanation, suggestion}.
    """
    # Retrieve context
    ctx = retrieve_context(
        query=content,
        topic_id=topic_id,
        db=db,
        n_vector_results=5,
        max_graph_hops=1,
        max_total_nodes=15,
    )

    # Filter to high-similarity hits
    high_sim = [h for h in ctx["vector_hits"] if h["similarity"] >= similarity_threshold]

    if not high_sim and not ctx["graph_expanded"]:
        # No similar content found at all
        return {
            "is_duplicate": False,
            "confidence": 0.95,
            "similar_arguments": [],
            "explanation": "No similar arguments found in this debate.",
            "suggestion": None,
        }

    # Use Claude for nuanced duplicate analysis
    from app.services.ai_service import is_available, _call_claude

    if not is_available():
        return _stub_duplicate_check(content, high_sim, ctx)

    # Build context for Claude
    context_text = "\n\n".join([
        f"EXISTING ARGUMENT (similarity: {h['similarity']:.2f}):\n{h['content']}"
        for h in ctx["vector_hits"][:8]
    ])

    # Add graph-expanded context
    graph_only = [n for n in ctx["merged_context"] if n.get("source") == "graph"]
    if graph_only:
        context_text += "\n\n--- Related arguments from the debate graph ---\n\n"
        context_text += "\n\n".join([
            f"RELATED ({n.get('node_type', 'unknown')} — {n.get('state', 'unknown')}):\n{n['content'][:300]}"
            for n in graph_only[:5]
        ])

    system = """You are a duplicate detection system for a structured debate platform.
Determine if a new argument is a semantic duplicate of existing arguments.

Duplicates include:
- Same claim with different wording
- Same evidence cited for same conclusion
- Subsumption: new argument is entirely contained in an existing one

NOT duplicates:
- Same topic but different angle/evidence
- Similar claim but different scope (one geographic, one general)
- Building on an existing argument with NEW evidence or reasoning
- Qualification or exception to an existing argument

Respond with valid JSON only. No markdown fences."""

    user = f"""NEW ARGUMENT:
{content}

EXISTING ARGUMENTS:
{context_text}

Return JSON:
{{
  "is_duplicate": <true/false>,
  "confidence": <0.0-1.0>,
  "duplicate_of_id": "<id of the most similar existing argument, or null>",
  "explanation": "<1-2 sentence explanation of why this is/isn't a duplicate>",
  "suggestion": "<if duplicate, suggest how to make it unique — add new evidence, different angle, etc. Null if not duplicate.>"
}}"""

    try:
        raw = _call_claude(system, user)
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        result = json.loads(raw)
        result["similar_arguments"] = [
            {
                "id": h["id"],
                "content_preview": h["content"][:150],
                "similarity": h["similarity"],
            }
            for h in ctx["vector_hits"][:3]
        ]
        result["ai_powered"] = True
        return result
    except Exception as e:
        print(f"[GraphRAG] duplicate check Claude error: {e}", file=sys.stderr)
        return _stub_duplicate_check(content, high_sim, ctx)


def _stub_duplicate_check(content: str, high_sim: list, ctx: dict) -> dict:
    """Fallback duplicate check without AI."""
    is_dup = len(high_sim) > 0 and high_sim[0]["similarity"] > 0.85

    return {
        "is_duplicate": is_dup,
        "confidence": high_sim[0]["similarity"] if high_sim else 0.0,
        "similar_arguments": [
            {
                "id": h["id"],
                "content_preview": h["content"][:150],
                "similarity": h["similarity"],
            }
            for h in (high_sim or ctx["vector_hits"])[:3]
        ],
        "explanation": (
            f"Found {len(high_sim)} argument(s) with >75% similarity."
            if high_sim else
            "No highly similar arguments found."
        ),
        "suggestion": (
            "Consider adding new evidence or a different perspective to differentiate your argument."
            if is_dup else None
        ),
        "ai_powered": False,
    }


def rag_briefing(
    topic_question: str,
    query: str,
    topic_id: str,
    db: Session,
    author_id: Optional[str] = None,
) -> dict:
    """
    Generate a RAG-powered briefing focused on a specific question within a debate.
    Pass author_id to restrict context to a specific contributor.
    """
    ctx = retrieve_context(
        query=query,
        topic_id=topic_id,
        db=db,
        n_vector_results=10,
        max_graph_hops=2,
        max_total_nodes=30,
        author_id=author_id,
    )

    from app.services.ai_service import is_available, _call_claude

    if not is_available():
        return {
            "answer": "AI not available. Enable ANTHROPIC_API_KEY for RAG-powered briefings.",
            "context_used": len(ctx["merged_context"]),
            "ai_powered": False,
        }

    def _fmt_node(n: dict) -> str:
        author = n.get("author_display_name") or n.get("metadata", {}).get("author_display_name") or "unknown"
        node_type = n.get('node_type', '?').upper()
        sim = n.get('similarity')
        sim_str = f", sim: {sim:.2f}" if isinstance(sim, float) and sim < 1.0 else ""
        return f"[{node_type}] by {author}{sim_str}:\n{n['content'][:400]}"

    context_text = "\n\n".join([_fmt_node(n) for n in ctx["merged_context"][:20]])

    system = """You are a neutral debate analyst using retrieved context to answer questions about an ongoing debate.
Only use information from the provided context. If the context doesn't contain enough information, say so.
Cite specific arguments when possible. Be balanced and present all sides."""

    user = f"""DEBATE TOPIC: {topic_question}

QUESTION: {query}

RETRIEVED CONTEXT (from vector search + graph expansion):
{context_text}

Provide a thorough, balanced answer based on the debate context above."""

    try:
        answer = _call_claude(system, user)
        return {
            "answer": answer,
            "context_used": len(ctx["merged_context"]),
            "retrieval_stats": ctx["stats"],
            "ai_powered": True,
        }
    except Exception as e:
        print(f"[GraphRAG] rag_briefing error: {e}", file=sys.stderr)
        return {
            "answer": f"Error generating RAG briefing: {e}",
            "context_used": 0,
            "ai_powered": False,
        }
