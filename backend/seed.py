"""
Seed script — creates example users, topics, tracks, and arguments.
Run from backend/ with the venv active:
  python seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base
from app.models import (
    User, Topic, DiscourseTrack, ArgumentNode, ArgumentEdge,
    NodeType, NuanceTag, ArgumentState, EdgeRelationship, TopicStatus, TopicTag
)
import bcrypt as _bcrypt

def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt()).decode()

Base.metadata.create_all(bind=engine)
db = SessionLocal()


def clear():
    db.query(ArgumentEdge).delete()
    db.query(ArgumentNode).delete()
    db.query(DiscourseTrack).delete()
    db.query(Topic).delete()
    db.query(User).delete()
    db.commit()


# ── Users ─────────────────────────────────────────────────────────────────────

def make_user(email, username, display_name, expert=False, domain=None, score=60.0):
    u = User(
        email=email,
        username=username,
        display_name=display_name,
        hashed_password=hash_password("password123"),
        credibility_score=score,
        is_verified_expert=expert,
        expert_domain=domain,
    )
    db.add(u)
    return u


# ── Arguments helper ──────────────────────────────────────────────────────────

def make_node(topic, author, content, node_type, track=None, sources=None,
              nuance_tags=None, parent=None, state=ArgumentState.unchallenged,
              confidence=0.88):
    n = ArgumentNode(
        topic_id=topic.id,
        track_id=track.id if track else None,
        parent_id=parent.id if parent else None,
        author_id=author.id,
        content=content,
        node_type=node_type,
        sources=sources or [],
        nuance_tags=nuance_tags or [],
        state=state,
        ai_classification_confidence=confidence,
    )
    db.add(n)
    db.flush()
    return n


def make_edge(source, target, rel):
    e = ArgumentEdge(source_id=source.id, target_id=target.id, relationship_type=rel)
    db.add(e)


# ─────────────────────────────────────────────────────────────────────────────
# SEED
# ─────────────────────────────────────────────────────────────────────────────

print("Clearing existing data...")
clear()

print("Creating users...")
sarah  = make_user("sarah@example.com",  "sarah_chen",     "Sarah Chen",     expert=True,  domain="Urban Economics", score=82.0)
marcus = make_user("marcus@example.com", "marcus_osei",    "Marcus Osei",    expert=True,  domain="Urban Planning",  score=79.0)
priya  = make_user("priya@example.com",  "priya_sharma",   "Priya Sharma",   expert=False, score=65.0)
david  = make_user("david@example.com",  "david_kowalski", "David Kowalski", expert=False, score=58.0)
elena  = make_user("elena@example.com",  "elena_vasquez",  "Elena Vasquez",  expert=True,  domain="Sociology",       score=77.0)
db.commit()

# ══════════════════════════════════════════════════════════════════════════════
# TOPIC 1 — Gentrification
# ══════════════════════════════════════════════════════════════════════════════

print("Creating topic 1 — Gentrification...")
t1 = Topic(
    canonical_question="Is gentrification net harmful to low-income urban residents in major US cities?",
    description="Examines whether the economic and cultural changes associated with gentrification produce a net harm or benefit for low-income people already living in affected neighbourhoods.",
    tags=["geographic", "social", "economic"],
    location="United States",
    created_by=sarah.id,
    status=TopicStatus.active,
)
db.add(t1)
db.flush()

tr1_econ    = DiscourseTrack(topic_id=t1.id, name="Economic effects",         auto_detected=True)
tr1_housing = DiscourseTrack(topic_id=t1.id, name="Housing & displacement",   auto_detected=True)
tr1_policy  = DiscourseTrack(topic_id=t1.id, name="Policy interventions",     auto_detected=False)
db.add_all([tr1_econ, tr1_housing, tr1_policy])
db.flush()

# — Argument tree —
a1 = make_node(
    t1, sarah,
    "Property tax revenues increase by an average of 30% in gentrifying neighbourhoods within 5 years of the onset of gentrification.",
    NodeType.assertion, tr1_econ,
    sources=[{"title": "Lincoln Institute of Land Policy, 2023", "url": "https://www.lincolninst.edu", "source_type": "academic"}],
    state=ArgumentState.engaged,
)

a2 = make_node(
    t1, marcus,
    "A 2022 Federal Reserve study found that gentrification reduced neighbourhood poverty rates by an average of 12 percentage points over a decade.",
    NodeType.assertion, tr1_econ,
    sources=[{"title": "Federal Reserve Bank of Philadelphia, 2022", "url": "https://www.philadelphiafed.org", "source_type": "government"}],
    state=ArgumentState.engaged,
)

a3 = make_node(
    t1, elena,
    "Poverty rate reductions in gentrifying areas primarily reflect the displacement of poor residents to other neighbourhoods, not an improvement in their economic conditions.",
    NodeType.counter, tr1_econ,
    sources=[{"title": "Dragan et al., Journal of Urban Economics, 2019", "url": "https://www.sciencedirect.com", "source_type": "academic"}],
    parent=a2, state=ArgumentState.engaged, nuance_tags=["population_specific"],
)
make_edge(a3, a2, EdgeRelationship.challenges)

a4 = make_node(
    t1, sarah,
    "Controlling for selection effects, Lance Freeman (2005) found that incumbent residents in gentrifying areas were no more likely to move than those in non-gentrifying areas.",
    NodeType.counter, tr1_econ,
    sources=[{"title": "Freeman, Urban Affairs Review, 2005", "url": "https://journals.sagepub.com", "source_type": "academic"}],
    parent=a3, state=ArgumentState.engaged,
)
make_edge(a4, a3, EdgeRelationship.challenges)

a5 = make_node(
    t1, david,
    "Rising property assessments directly cause long-term renters to face large rent increases, even in rent-stabilised buildings, through mechanisms like preferential rent loss.",
    NodeType.assertion, tr1_housing,
    sources=[{"title": "Community Service Society NY, 2021", "url": "https://www.cssny.org", "source_type": "article"}],
    state=ArgumentState.engaged, nuance_tags=["geographic", "conditional"],
)

a6 = make_node(
    t1, priya,
    "The displacement effect is substantially stronger in cities without meaningful rent control ordinances — cities with strong tenant protections show 40% lower displacement rates.",
    NodeType.qualification, tr1_housing,
    sources=[{"title": "Urban Institute, 2020", "url": "https://www.urban.org", "source_type": "academic"}],
    parent=a5, state=ArgumentState.engaged, nuance_tags=["conditional", "geographic"],
)
make_edge(a6, a5, EdgeRelationship.qualifies)

a7 = make_node(
    t1, sarah,
    "The poverty reduction effect documented by the Federal Reserve reverses in areas of extreme gentrification (defined as >50% median income change), where displacement outpaces economic integration.",
    NodeType.exception, tr1_econ,
    sources=[{"title": "Autor, Palmer & Pathak, AER, 2014", "url": "https://www.aeaweb.org", "source_type": "academic"}],
    parent=a2, state=ArgumentState.unchallenged, nuance_tags=["scale", "conditional"],
)
make_edge(a7, a2, EdgeRelationship.qualifies)

a8 = make_node(
    t1, marcus,
    "All parties in this debate appear to agree that current residents face higher housing cost burdens as gentrification progresses — disagreement centres on whether this constitutes net harm.",
    NodeType.synthesis, tr1_housing,
    state=ArgumentState.unchallenged,
)

a9 = make_node(
    t1, priya,
    "What evidence-based policy interventions have demonstrably prevented displacement without halting neighbourhood investment? The literature has few successful examples.",
    NodeType.open_question, tr1_policy,
    state=ArgumentState.unchallenged,
)

# More arguments for richer graph
a10 = make_node(
    t1, david,
    "Vienna's social housing model — where 60% of residents live in city-subsidised housing — demonstrates that neighbourhood investment and affordability can coexist without mass displacement.",
    NodeType.assertion, tr1_policy,
    sources=[{"title": "LSE Cities, Vienna Housing Report, 2021", "url": "https://lsecities.net", "source_type": "academic"}],
    parent=a9, state=ArgumentState.engaged, nuance_tags=["geographic"],
)
make_edge(a10, a9, EdgeRelationship.challenges)

a11 = make_node(
    t1, sarah,
    "Vienna's model requires decades of political commitment and is not replicable in cities operating under market-led housing systems or with different constitutional frameworks.",
    NodeType.counter, tr1_policy,
    sources=[{"title": "Aalbers, Housing Policy in European Cities, 2022", "url": "https://www.routledge.com", "source_type": "academic"}],
    parent=a10, state=ArgumentState.engaged, nuance_tags=["geographic", "conditional"],
)
make_edge(a11, a10, EdgeRelationship.challenges)

a12 = make_node(
    t1, marcus,
    "Community Land Trusts in Burlington, VT maintained affordability for 25+ years across gentrification cycles, providing a US-applicable model.",
    NodeType.counter, tr1_policy,
    sources=[{"title": "Davis, Community Land Trusts, Grounded Solutions, 2020", "url": "https://groundedsolutions.org", "source_type": "academic"}],
    parent=a11, state=ArgumentState.engaged, nuance_tags=["geographic", "scale"],
)
make_edge(a12, a11, EdgeRelationship.challenges)

a13 = make_node(
    t1, elena,
    "CLTs have worked at neighbourhood scale but have not been demonstrated at citywide scale — Burlington has fewer than 600 CLT homes; a city like Chicago would need 200,000+.",
    NodeType.exception, tr1_policy,
    sources=[{"title": "Jacobus, Cornerstone CLT Study, 2022", "url": "https://www.ncsha.org", "source_type": "academic"}],
    parent=a12, state=ArgumentState.unchallenged, nuance_tags=["scale"],
)
make_edge(a13, a12, EdgeRelationship.qualifies)

a14 = make_node(
    t1, david,
    "The commercial real estate tax increment financing used to fund gentrification-adjacent developments frequently subsidises the very forces driving displacement.",
    NodeType.reframe, tr1_econ,
    sources=[{"title": "Weber, Making Tax Increment Financing Work, Urban Affairs Review, 2020", "url": "https://journals.sagepub.com", "source_type": "academic"}],
    state=ArgumentState.unchallenged, nuance_tags=["conditional"],
)

a15 = make_node(
    t1, priya,
    "I concede that neighbourhood investment produces genuine economic benefits — the core dispute is distributional: who captures those benefits and who bears the costs.",
    NodeType.concession, tr1_econ,
    state=ArgumentState.unchallenged,
)

a16 = make_node(
    t1, elena,
    "The 'net harm' framing of this debate may obscure more than it reveals — gentrification's effects are highly heterogeneous across cities, income levels, tenure types, and time horizons.",
    NodeType.reframe, tr1_econ,
    sources=[{"title": "Lees, Slater & Wyly, Gentrification, 2020", "url": "https://www.routledge.com", "source_type": "academic"}],
    state=ArgumentState.unchallenged, nuance_tags=["scale", "temporal", "geographic"],
)

db.commit()

# ══════════════════════════════════════════════════════════════════════════════
# TOPIC 2 — Immigration & wages
# ══════════════════════════════════════════════════════════════════════════════

print("Creating topic 2 — Immigration & wages...")
t2 = Topic(
    canonical_question="Does increased low-skilled immigration depress wages for native low-income workers?",
    description="Reviews the empirical economics literature on labour market competition between low-skilled immigrants and native workers, with particular focus on methodology disputes in the field.",
    tags=["economic", "social", "political"],
    created_by=elena.id,
    status=TopicStatus.active,
)
db.add(t2)
db.flush()

tr2_empirical = DiscourseTrack(topic_id=t2.id, name="Empirical evidence",        auto_detected=True)
tr2_method    = DiscourseTrack(topic_id=t2.id, name="Methodological disputes",   auto_detected=True)
tr2_framing   = DiscourseTrack(topic_id=t2.id, name="Question framing",          auto_detected=False)
db.add_all([tr2_empirical, tr2_method, tr2_framing])
db.flush()

b1 = make_node(
    t2, elena,
    "Card's (1990) Mariel Boatlift study — the most cited natural experiment on this question — found no significant wage or employment effect on Miami workers following the sudden arrival of 125,000 Cuban immigrants.",
    NodeType.assertion, tr2_empirical,
    sources=[{"title": "Card, Industrial & Labor Relations Review, 1990", "url": "https://journals.sagepub.com", "source_type": "academic"}],
    state=ArgumentState.engaged,
)

b2 = make_node(
    t2, david,
    "Borjas's (2017) reanalysis of the same Mariel Boatlift data, using a narrower comparison group, found wages for non-Hispanic male high school dropouts fell by 10–25%.",
    NodeType.counter, tr2_empirical,
    sources=[{"title": "Borjas, ILR Review, 2017", "url": "https://journals.sagepub.com", "source_type": "academic"}],
    parent=b1, state=ArgumentState.engaged,
)
make_edge(b2, b1, EdgeRelationship.challenges)

b3 = make_node(
    t2, sarah,
    "The Card-Borjas disagreement stems almost entirely from comparison group selection — Card used all US cities, Borjas used only cities with similar pre-1980 demographics. The data are identical; the methodology drives the finding.",
    NodeType.qualification, tr2_method,
    sources=[{"title": "Peri & Yasenov, Journal of Human Resources, 2019", "url": "https://jhr.uwpress.org", "source_type": "academic"}],
    parent=b2, state=ArgumentState.engaged, nuance_tags=["contested_empirically"],
)
make_edge(b3, b2, EdgeRelationship.qualifies)

b4 = make_node(
    t2, marcus,
    "OECD (2023) meta-analysis of 25 member countries finds immigration has a net neutral to slightly positive (+0.3%) effect on native wages across skill levels, with short-term negative effects confined to direct occupational competitors.",
    NodeType.assertion, tr2_empirical,
    sources=[{"title": "OECD, International Migration Outlook, 2023", "url": "https://www.oecd.org", "source_type": "government"}],
    state=ArgumentState.engaged, nuance_tags=["temporal", "geographic"],
)

b5 = make_node(
    t2, david,
    "OECD aggregate findings may mask significant distributional effects — even if mean wages are neutral, the workers most exposed to wage competition are already the lowest paid.",
    NodeType.exception, tr2_empirical,
    sources=[{"title": "Dustmann, Frattini & Preston, Economic Journal, 2013", "url": "https://academic.oup.com", "source_type": "academic"}],
    parent=b4, state=ArgumentState.unchallenged, nuance_tags=["scale", "population_specific"],
)
make_edge(b5, b4, EdgeRelationship.qualifies)

b6 = make_node(
    t2, priya,
    "The wage effect question may be secondary to the fiscal contribution question: OECD data consistently shows that working-age immigrants contribute more in taxes and social contributions than they consume in public services.",
    NodeType.reframe, tr2_framing,
    sources=[{"title": "OECD, Fiscal Impact of Immigration, 2022", "url": "https://www.oecd.org", "source_type": "government"}],
    state=ArgumentState.engaged,
)

b7 = make_node(
    t2, elena,
    "Reframing toward fiscal contribution does not address the distributional concern — the workers bearing wage costs and the taxpayers receiving fiscal benefits are largely different people.",
    NodeType.counter, tr2_framing,
    parent=b6, state=ArgumentState.unchallenged,
)
make_edge(b7, b6, EdgeRelationship.challenges)

b8 = make_node(
    t2, sarah,
    "Why does the most-studied natural experiment in labour economics (Mariel) produce such divergent results from identical data? This methodological fragility is itself a significant finding about the limits of this literature.",
    NodeType.open_question, tr2_method,
    state=ArgumentState.unchallenged,
)

db.commit()

# ══════════════════════════════════════════════════════════════════════════════
# TOPIC 3 — Cycling infrastructure
# ══════════════════════════════════════════════════════════════════════════════

print("Creating topic 3 — Cycling infrastructure...")
t3 = Topic(
    canonical_question="Should cities prioritise cycling infrastructure over car lanes in dense urban centres?",
    description="Examines the trade-offs between cycling infrastructure expansion and vehicle lane capacity in dense urban areas, including effects on emissions, equity, and local economies.",
    tags=["geographic", "social", "environmental"],
    location="Urban centres globally",
    created_by=marcus.id,
    status=TopicStatus.active,
)
db.add(t3)
db.flush()

tr3_env    = DiscourseTrack(topic_id=t3.id, name="Emissions & environment",  auto_detected=True)
tr3_equity = DiscourseTrack(topic_id=t3.id, name="Equity & access",          auto_detected=True)
tr3_econ   = DiscourseTrack(topic_id=t3.id, name="Economic effects",         auto_detected=True)
db.add_all([tr3_env, tr3_equity, tr3_econ])
db.flush()

c1 = make_node(
    t3, marcus,
    "Cities with high cycling modal share (>25%) have 30% lower per-capita transport emissions than car-centric cities of equivalent density (ITDP 2022).",
    NodeType.assertion, tr3_env,
    sources=[{"title": "Institute for Transportation & Development Policy, 2022", "url": "https://itdp.org", "source_type": "academic"}],
    state=ArgumentState.engaged, nuance_tags=["scale", "conditional"],
)

c2 = make_node(
    t3, david,
    "Removing car lanes in cities without strong public transit alternatives forces lower-income residents — who are less likely to own or afford e-bikes — into significantly longer commutes.",
    NodeType.counter, tr3_equity,
    sources=[{"title": "Martens, Transport & Social Exclusion, 2017", "url": "https://www.tandfonline.com", "source_type": "academic"}],
    parent=c1, state=ArgumentState.engaged, nuance_tags=["conditional", "population_specific"],
)
make_edge(c2, c1, EdgeRelationship.challenges)

c3 = make_node(
    t3, priya,
    "The equity concern is substantially mitigated in cities where cycling infrastructure is paired with subsidised bike-share programmes — London's Santander Cycles and NYC's Citi Bike both show disproportionate uptake in lower-income areas after subsidy introduction.",
    NodeType.qualification, tr3_equity,
    sources=[{"title": "McNeil et al., Transportation Research Record, 2021", "url": "https://journals.sagepub.com", "source_type": "academic"}],
    parent=c2, state=ArgumentState.unchallenged, nuance_tags=["conditional"],
)
make_edge(c3, c2, EdgeRelationship.qualifies)

c4 = make_node(
    t3, sarah,
    "Converting a car lane to a protected cycle lane on Ninth Avenue, NYC increased adjacent retail sales by 49% over 2 years (NYC DOT, 2014).",
    NodeType.assertion, tr3_econ,
    sources=[{"title": "NYC Department of Transportation, 2014", "url": "https://www.nyc.gov/dot", "source_type": "government"}],
    state=ArgumentState.engaged,
)

c5 = make_node(
    t3, elena,
    "The NYC DOT report measured pedestrian and cyclist counts, not direct retail revenue. The 49% figure is contested — subsequent peer-reviewed analysis found no statistically significant revenue effect.",
    NodeType.counter, tr3_econ,
    sources=[{"title": "Jacobsen & Rutter, Journal of Planning Education, 2018", "url": "https://www.tandfonline.com", "source_type": "academic"}],
    parent=c4, state=ArgumentState.engaged,
)
make_edge(c5, c4, EdgeRelationship.challenges)

c6 = make_node(
    t3, sarah,
    "I concede the retail revenue data is weaker than I initially represented. The pedestrian activity increase is well-documented even if revenue causation is not.",
    NodeType.concession, tr3_econ,
    parent=c5, state=ArgumentState.unchallenged,
)
make_edge(c6, c5, EdgeRelationship.synthesizes)

c7 = make_node(
    t3, marcus,
    "There is broad cross-partisan agreement that cycling infrastructure improvements reduce hospitalisation rates from road incidents and improve population-level cardiovascular health outcomes — the health case is separate from the emissions and economic debates.",
    NodeType.synthesis, tr3_env,
    sources=[{"title": "WHO, Global Status Report on Road Safety, 2023", "url": "https://www.who.int", "source_type": "government"}],
    state=ArgumentState.unchallenged,
)

c8 = make_node(
    t3, david,
    "Does the emissions benefit of cycling infrastructure justify the cost when cities with poor public transit could achieve greater emissions reductions per dollar through transit electrification?",
    NodeType.open_question, tr3_env,
    state=ArgumentState.unchallenged,
)

db.commit()

print("\nSeed complete.")
print(f"  Users   : 5  (password for all: password123)")
print(f"  Topics  : 3")
print(f"  Tracks  : {3+3+3} across all topics")
print(f"  Args    : {db.query(ArgumentNode).count()}")
print(f"  Edges   : {db.query(ArgumentEdge).count()}")
print("\nSample logins:")
print("  sarah@example.com / password123  (expert, urban economics)")
print("  david@example.com / password123  (community perspective)")
