"""
One-time script to recluster all topics that have generic Pro/Con/Nuance tracks.
Replaces them with AI-discovered thematic currents.

Usage: python fix_generic_tracks.py
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models import DiscourseTrack, ArgumentNode, Topic
from app.services.ai_service import discover_currents

db = SessionLocal()

GENERIC = {"Pro", "Con", "Nuance"}
generic_tracks = db.query(DiscourseTrack).filter(DiscourseTrack.name.in_(GENERIC)).all()
affected_topic_ids = list(set(t.topic_id for t in generic_tracks))
print(f"Found {len(affected_topic_ids)} topics with generic Pro/Con/Nuance tracks\n")

for i, tid in enumerate(affected_topic_ids):
    topic = db.query(Topic).filter(Topic.id == tid).first()
    if not topic:
        continue
    q = topic.canonical_question
    print(f"[{i+1}/{len(affected_topic_ids)}] {q[:70]}")

    args = db.query(ArgumentNode).filter(ArgumentNode.topic_id == tid).all()
    if len(args) < 2:
        print("   Too few arguments, skipping\n")
        continue

    arg_dicts = [
        {"id": str(a.id), "content": a.content[:400], "node_type": a.node_type.value}
        for a in args
    ]

    try:
        currents = discover_currents(q, arg_dicts)

        # Remove old generic tracks
        old = db.query(DiscourseTrack).filter(
            DiscourseTrack.topic_id == tid,
            DiscourseTrack.name.in_(GENERIC),
        ).all()
        for ot in old:
            db.delete(ot)
        db.flush()

        # Create new tracks + assign arguments
        aid_to_track = {}
        for cur in currents:
            track = DiscourseTrack(
                topic_id=tid,
                name=cur["name"],
                description=cur.get("description", ""),
                auto_detected=True,
            )
            db.add(track)
            db.flush()
            for aid in cur.get("argument_ids", []):
                aid_to_track[aid] = track.id
            print(f"   -> {cur['name']} ({len(cur.get('argument_ids', []))} takes)")

        for a in args:
            new_tid = aid_to_track.get(str(a.id))
            if new_tid:
                a.track_id = new_tid

        db.commit()
        print("   OK\n")
        time.sleep(1)

    except Exception as e:
        db.rollback()
        print(f"   FAILED: {e}\n")

db.close()
print("Done!")
