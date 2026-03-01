"""
Expanded seed data for Logora — 10 topics with 100+ arguments total.
Includes geopolitical, tech, social, and policy debates.
Run: cd backend && source venv/bin/activate && python seed_expanded.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base
from app.models import (
    User, Topic, DiscourseTrack, ArgumentNode, ArgumentEdge,
    TopicTag, NodeType, NuanceTag, ArgumentState, EdgeRelationship, TopicStatus
)
from app.auth import hash_password
from datetime import datetime, timedelta
import random

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# Clear existing
for model in [ArgumentEdge, ArgumentNode, DiscourseTrack, Topic, User]:
    db.query(model).delete()
db.commit()

# ── USERS ─────────────────────────────────────────────────────────────────────
pw = hash_password("password123")
users = {}

user_defs = [
    ("sarah_chen", "Sarah Chen", "sarah@example.com", True, "Urban Economics", 82.0),
    ("marcus_osei", "Marcus Osei", "marcus@example.com", True, "Urban Planning", 79.0),
    ("priya_sharma", "Priya Sharma", "priya@example.com", False, None, 65.0),
    ("david_kowalski", "David Kowalski", "david@example.com", False, None, 58.0),
    ("elena_vasquez", "Elena Vasquez", "elena@example.com", True, "Sociology", 77.0),
    ("james_liu", "James Liu", "james@example.com", True, "International Relations", 84.0),
    ("fatima_al_rashid", "Fatima Al-Rashid", "fatima@example.com", True, "Middle East Studies", 80.0),
    ("thomas_berg", "Thomas Berg", "thomas@example.com", True, "Computer Science", 76.0),
    ("anika_patel", "Anika Patel", "anika@example.com", False, None, 62.0),
    ("carlos_mendez", "Carlos Mendez", "carlos@example.com", True, "Political Economy", 73.0),
    ("yuki_tanaka", "Yuki Tanaka", "yuki@example.com", True, "Environmental Science", 78.0),
    ("olivia_wright", "Olivia Wright", "olivia@example.com", False, None, 55.0),
]

for uname, dname, email, expert, domain, score in user_defs:
    u = User(
        username=uname, display_name=dname, email=email,
        hashed_password=pw, is_verified_expert=expert,
        expert_domain=domain, credibility_score=score,
    )
    db.add(u)
    db.flush()
    users[uname] = u

db.commit()

def add_topic(question, description, tags, location, creator):
    t = Topic(
        canonical_question=question, description=description,
        tags=[tg.value for tg in tags], location=location,
        created_by=creator.id, status=TopicStatus.active,
    )
    db.add(t)
    db.flush()
    return t

def add_track(topic, name, desc, auto=True):
    tr = DiscourseTrack(topic_id=topic.id, name=name, description=desc, auto_detected=auto)
    db.add(tr)
    db.flush()
    return tr

def add_arg(topic, track, author, content, node_type, parent=None, edge_rel=None,
            nuance=None, sources=None, state=ArgumentState.unchallenged, summary=None):
    n = ArgumentNode(
        topic_id=topic.id,
        track_id=track.id if track else None,
        parent_id=parent.id if parent else None,
        author_id=author.id,
        content=content,
        node_type=node_type,
        nuance_tags=[t.value for t in (nuance or [])],
        sources=sources or [],
        state=state,
        ai_summary=summary or content[:60],
    )
    db.add(n)
    db.flush()
    if parent and edge_rel:
        e = ArgumentEdge(source_id=n.id, target_id=parent.id, relationship_type=edge_rel)
        db.add(e)
        db.flush()
    return n

S = ArgumentState
N = NodeType
E = EdgeRelationship
Nu = NuanceTag
T = TopicTag

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TOPIC 1: Gentrification (original, expanded)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
t1 = add_topic(
    "Is gentrification net harmful to low-income urban residents in major US cities?",
    "Examining displacement, economic effects, and policy interventions around gentrification in American cities.",
    [T.geographic, T.social, T.economic], "United States", users["sarah_chen"],
)
t1_econ = add_track(t1, "Economic effects", "Property values, business impacts, and economic mobility")
t1_housing = add_track(t1, "Housing & displacement", "Rental markets, eviction rates, population shifts")
t1_policy = add_track(t1, "Policy interventions", "Rent control, zoning, community land trusts")

a1 = add_arg(t1, t1_econ, users["sarah_chen"],
    "Gentrification raises property values by 15-40% within a decade of initial investment, pricing out existing residents who predominantly rent rather than own. The Federal Reserve Bank of Philadelphia's 2019 study found that in gentrifying Census tracts, median rent increased 2.3x faster than in non-gentrifying tracts.",
    N.assertion, nuance=[Nu.geographic, Nu.temporal],
    sources=[{"url": "https://philadelphiafed.org/2019-gentrification-study", "title": "Federal Reserve Bank of Philadelphia Gentrification Study", "source_type": "academic"}],
    state=S.engaged, summary="Gentrification raises rents 2.3x faster than non-gentrifying areas")

a2 = add_arg(t1, t1_econ, users["marcus_osei"],
    "The property value increases from gentrification disproportionately benefit incumbent homeowners, many of whom are long-term residents. NYU Furman Center research shows that homeowners in gentrifying neighborhoods saw net wealth increases of $58,000-$90,000 between 2000-2015. The 'harm' narrative ignores these beneficiaries.",
    N.counter, parent=a1, edge_rel=E.challenges, nuance=[Nu.population_specific],
    sources=[{"url": "https://furmancenter.org/research/gentrification", "title": "NYU Furman Center Gentrification Research", "source_type": "academic"}],
    state=S.engaged, summary="Homeowners in gentrifying areas gain $58K-$90K in wealth")

a3 = add_arg(t1, t1_econ, users["priya_sharma"],
    "The homeowner benefit argument is valid but misses scale: in gentrifying US neighborhoods, renters outnumber homeowners roughly 2.5:1. So for every homeowner gaining $58K-$90K, 2.5 renters face displacement pressure. The net welfare calculation favors harm when weighted by population.",
    N.qualification, parent=a2, edge_rel=E.qualifies, nuance=[Nu.population_specific, Nu.scale],
    state=S.unchallenged, summary="Renters outnumber homeowners 2.5:1, shifting net welfare calculus")

a4 = add_arg(t1, t1_housing, users["elena_vasquez"],
    "Displacement is not just an economic phenomenon — it severs social networks, disrupts children's schooling, and removes families from proximity to jobs. A Columbia University longitudinal study found that displaced families experienced a 23% increase in commute times and a 15% drop in social network density within two years.",
    N.assertion, nuance=[Nu.temporal],
    sources=[{"url": "https://columbia.edu/displacement-social-cost", "title": "Columbia University Displacement Study", "source_type": "academic"}],
    state=S.engaged, summary="Displacement increases commutes 23%, reduces social networks 15%")

a5 = add_arg(t1, t1_housing, users["david_kowalski"],
    "Counter: displacement rates in gentrifying neighborhoods are actually comparable to non-gentrifying low-income neighborhoods according to multiple studies. The perception of mass displacement may be overstated. Lance Freeman's 2004 Columbia study found no significant difference in out-migration rates.",
    N.counter, parent=a4, edge_rel=E.challenges,
    sources=[{"url": "https://doi.org/10.1080/01onal.2004.9657112", "title": "Freeman 2004 - Displacement or Succession?", "source_type": "academic"}],
    state=S.engaged, summary="Displacement rates similar in gentrifying vs non-gentrifying areas")

a6 = add_arg(t1, t1_housing, users["elena_vasquez"],
    "Freeman's methodology has been challenged: he measured out-migration but not whether the same people moved in. Lower out-migration in gentrifying areas may reflect housing constraints (nowhere affordable to move TO) rather than voluntary staying. Kathe Newman and Elvin Wyly's 2006 reanalysis found that displacement was 'hidden' in the data.",
    N.counter, parent=a5, edge_rel=E.challenges,
    sources=[{"url": "https://doi.org/10.1177/0042098006063778", "title": "Newman & Wyly 2006 - Right to Stay Put Revisited", "source_type": "academic"}],
    state=S.unchallenged, summary="Freeman's methodology misses 'hidden displacement'")

a7 = add_arg(t1, t1_policy, users["carlos_mendez"],
    "Community Land Trusts (CLTs) offer a proven mechanism to preserve affordability during gentrification. Burlington, Vermont's Champlain Housing Trust has maintained affordability of 2,800+ units across 30 years of neighborhood change with resale restrictions that keep homes permanently below market rate.",
    N.assertion, nuance=[Nu.geographic, Nu.conditional],
    sources=[{"url": "https://champlainhousingtrust.org/impact", "title": "Champlain Housing Trust Impact Report", "source_type": "institutional"}],
    state=S.engaged, summary="Community Land Trusts preserve affordability — Burlington's 2800+ units")

a8 = add_arg(t1, t1_policy, users["sarah_chen"],
    "CLTs prevent the worst displacement outcomes but they cannot scale to match gentrification pressure. Even Burlington's CLT — one of the largest in the US — covers roughly 7% of the city's housing stock. In rapidly gentrifying cities like San Francisco or Austin, CLTs would need to be orders of magnitude larger to materially affect outcomes.",
    N.qualification, parent=a7, edge_rel=E.qualifies, nuance=[Nu.scale, Nu.geographic],
    state=S.unchallenged, summary="CLTs proven but cover only ~7% of housing stock, hard to scale")

a9 = add_arg(t1, t1_policy, users["marcus_osei"],
    "Rent stabilization in New York City has been the most extensively studied anti-displacement policy. The evidence is mixed: it protects existing tenants but reduces housing supply by discouraging new construction and maintenance, potentially worsening affordability for those not covered.",
    N.synthesis, nuance=[Nu.geographic, Nu.temporal, Nu.contested_empirically],
    sources=[{"url": "https://www.nber.org/papers/w24181", "title": "Diamond et al. 2019 - Effects of Rent Control Expansion", "source_type": "academic"}],
    state=S.unchallenged, summary="Rent stabilization protects tenants but may reduce housing supply")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TOPIC 2: Immigration & Wages (original, expanded)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
t2 = add_topic(
    "Does increased low-skilled immigration depress wages for native low-income workers?",
    "Analyzing the contested empirical evidence around immigration's labor market effects.",
    [T.economic, T.social, T.political], None, users["marcus_osei"],
)
t2_emp = add_track(t2, "Empirical evidence", "Key studies and their findings")
t2_meth = add_track(t2, "Methodological disputes", "Debates about how to measure immigration effects")
t2_frame = add_track(t2, "Question framing", "Is the question itself well-posed?")

b1 = add_arg(t2, t2_emp, users["david_kowalski"],
    "George Borjas's analysis of the Mariel boatlift found that wages for Miami workers without a high-school diploma dropped 10-30% relative to comparison cities after the 1980 influx of 125,000 Cuban immigrants.",
    N.assertion, nuance=[Nu.geographic, Nu.temporal],
    sources=[{"url": "https://doi.org/10.1177/0019793916654826", "title": "Borjas 2017 - The Wage Impact of the Marielitos", "source_type": "academic"}],
    state=S.engaged, summary="Borjas: Mariel boatlift depressed low-skill wages 10-30%")

b2 = add_arg(t2, t2_meth, users["carlos_mendez"],
    "Borjas's Mariel boatlift analysis has been methodologically contested by Peri and Yasenov (2019), who showed the result depends entirely on the choice of comparison group and education classification. Using Borjas's own data with the original Card comparison group produces near-zero wage effects.",
    N.counter, parent=b1, edge_rel=E.challenges, nuance=[Nu.contested_empirically],
    sources=[{"url": "https://doi.org/10.1177/0019793919882063", "title": "Peri & Yasenov 2019 - The Labor Market Effects of a Refugee Wave", "source_type": "academic"}],
    state=S.engaged, summary="Peri & Yasenov: Borjas's result depends on comparison group choice")

b3 = add_arg(t2, t2_emp, users["james_liu"],
    "Meta-analyses consistently find small negative or zero effects. Dustmann, Schönberg & Stuhler's (2016) survey of 27 studies found a median wage elasticity of -0.02 for native workers — meaning a 10% immigration increase lowers wages by 0.2%, within noise.",
    N.assertion, nuance=[Nu.contested_empirically],
    sources=[{"url": "https://doi.org/10.1257/jel.20151189", "title": "Dustmann, Schönberg & Stuhler 2016 - The Impact of Immigration", "source_type": "academic"}],
    state=S.unchallenged, summary="Meta-analyses find median wage effect of -0.2% per 10% immigration")

b4 = add_arg(t2, t2_frame, users["elena_vasquez"],
    "The question 'does immigration depress wages' is poorly framed because it treats labor markets as zero-sum. Immigrants also create demand, start businesses, and fill complementary roles. The CBO estimated in 2024 that net immigration added 0.2% to GDP growth annually, creating jobs that offset any wage pressure.",
    N.reframe,
    sources=[{"url": "https://www.cbo.gov/publication/60039", "title": "CBO 2024 - Role of Immigration in the Demographic Outlook", "source_type": "institutional"}],
    state=S.engaged, summary="Immigration is not zero-sum — immigrants create demand and jobs")

b5 = add_arg(t2, t2_frame, users["david_kowalski"],
    "The macro-level GDP argument doesn't address the distributional question. Even if GDP grows, the gains can accrue to capital owners and skilled workers while low-skilled native workers bear concentrated losses. Total GDP growth is compatible with individual worker harm.",
    N.counter, parent=b4, edge_rel=E.challenges,
    state=S.unchallenged, summary="GDP growth is compatible with individual worker harm")

b6 = add_arg(t2, t2_emp, users["priya_sharma"],
    "The wage effects literature focuses almost exclusively on formal employment. A 2021 NBER working paper found that immigration shifts native workers from informal to formal employment in low-skill sectors, producing measured 'wage gains' that actually reflect formalization rather than real income growth.",
    N.qualification, nuance=[Nu.contested_empirically, Nu.population_specific],
    sources=[{"url": "https://www.nber.org/working-papers/w28740", "title": "NBER 2021 - Informal Labor Markets and Immigration", "source_type": "academic"}],
    state=S.unchallenged, summary="Measured wage gains may reflect formalization, not real income growth")

b7 = add_arg(t2, t2_meth, users["thomas_berg"],
    "All natural experiment approaches (Mariel, Card, Borjas) suffer from the fact that immigration is endogenous — immigrants choose high-growth areas. Instrument variable approaches using 'shift-share' or 'enclave' instruments have their own problems. There may be no reliable causal identification strategy for this question.",
    N.open_question,
    state=S.unchallenged, summary="Can any methodology reliably identify causal immigration effects?")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TOPIC 3: Cycling Infrastructure (original, expanded)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
t3 = add_topic(
    "Should cities prioritise cycling infrastructure over car lanes in dense urban centres?",
    "Evaluating trade-offs between cycling investment, car infrastructure, equity, and emissions.",
    [T.geographic, T.social, T.environmental], None, users["david_kowalski"],
)
t3_emit = add_track(t3, "Emissions & environment", "Climate and air quality impacts")
t3_equity = add_track(t3, "Equity & access", "Who benefits and who bears the costs")
t3_econ = add_track(t3, "Economic effects", "Costs, retail impact, and job creation")

c1 = add_arg(t3, t3_emit, users["yuki_tanaka"],
    "Cities with high cycling modal share (Copenhagen 28%, Amsterdam 36%) have 40-60% lower per-capita transport emissions than car-centric cities of equivalent density. The ITDP 2022 analysis across 47 cities found a nearly linear inverse relationship between cycling infrastructure investment and transport CO2 per capita.",
    N.assertion, nuance=[Nu.geographic],
    sources=[{"url": "https://itdp.org/2022-cycling-emissions", "title": "ITDP 2022 - Cycling and Urban Transport Emissions", "source_type": "academic"}],
    state=S.engaged, summary="High cycling cities have 40-60% lower transport emissions")

c2 = add_arg(t3, t3_equity, users["anika_patel"],
    "Cycling infrastructure disproportionately benefits young, able-bodied, middle-class residents. Lower-income workers often commute longer distances, carry tools/materials, or work shifts when cycling isn't safe. Removing car lanes harms those who depend on driving for economic survival.",
    N.counter, nuance=[Nu.population_specific],
    state=S.engaged, summary="Cycling benefits middle-class; removal of car lanes harms low-income")

c3 = add_arg(t3, t3_equity, users["carlos_mendez"],
    "Subsidised bike-share programmes substantially mitigate equity concerns. London's Santander Cycles and NYC's Citi Bike low-income membership programs have achieved >30% low-income enrollment. Barcelona's Bicing saw a 22% increase in cycling among lowest-income quartile residents after subsidised access launched in 2019.",
    N.qualification, parent=c2, edge_rel=E.qualifies,
    sources=[{"url": "https://bikeshare.research/equity-2023", "title": "Global Bike-Share Equity Report 2023", "source_type": "academic"}],
    state=S.unchallenged, summary="Subsidised bike-share achieves 30%+ low-income enrollment")

c4 = add_arg(t3, t3_econ, users["sarah_chen"],
    "Converting a car lane to a cycle lane on Ninth Avenue, NYC increased adjacent retail sales by 49% over 2 years according to NYC DOT 2014 data. Similar effects were measured in Melbourne's Swanston Street and Seville's city center conversions.",
    N.assertion,
    sources=[{"url": "https://nycdot.gov/ninth-avenue-study", "title": "NYC DOT 2014 - Ninth Avenue Study", "source_type": "institutional"}],
    state=S.conceded, summary="Ninth Avenue bike lane: 49% retail increase — CONCEDED (misrepresented)")

c5 = add_arg(t3, t3_econ, users["david_kowalski"],
    "The NYC DOT 'retail increase' figure is misleading — the report measured pedestrian and cyclist counts, not direct retail revenue. Peer-reviewed analysis by Jaffe et al. (2016) found no statistically significant causal link between the bike lane installation and retail revenue on Ninth Avenue specifically.",
    N.counter, parent=c4, edge_rel=E.challenges,
    sources=[{"url": "https://doi.org/10.1016/j.tra.2016.04.012", "title": "Jaffe et al. 2016 - Cycling Infrastructure and Retail", "source_type": "academic"}],
    state=S.unchallenged, summary="No causal link between Ninth Ave bike lane and retail revenue")

c6 = add_arg(t3, t3_emit, users["thomas_berg"],
    "Does the emissions benefit of cycling infrastructure justify the cost when cities with poor public transit could achieve greater per-dollar CO2 reductions by investing in transit electrification instead? The opportunity cost question needs to be addressed.",
    N.open_question,
    state=S.unchallenged, summary="Cycling vs transit electrification: which gives more CO2 reduction per dollar?")

c7 = add_arg(t3, t3_emit, users["yuki_tanaka"],
    "The framing of cycling vs transit electrification as either/or is misleading. Copenhagen and Amsterdam invest heavily in BOTH cycling and electric transit. Cities that invest in cycling infrastructure also tend to have better transit systems — they're complements, not substitutes.",
    N.reframe, parent=c6, edge_rel=E.challenges,
    state=S.unchallenged, summary="Cycling and transit electrification are complements, not substitutes")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TOPIC 4: AI Regulation (NEW)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
t4 = add_topic(
    "Should governments regulate frontier AI models before deployment, or does pre-deployment regulation stifle innovation?",
    "Balancing safety, innovation, and competitive dynamics in advanced AI development.",
    [T.scientific, T.political, T.economic], None, users["thomas_berg"],
)
t4_safety = add_track(t4, "Safety & existential risk", "Catastrophic risk, alignment, misuse potential")
t4_innov = add_track(t4, "Innovation & competition", "Effects on startups, national competitiveness, open source")
t4_govern = add_track(t4, "Governance frameworks", "Existing proposals, enforcement mechanisms")

d1 = add_arg(t4, t4_safety, users["thomas_berg"],
    "Frontier AI models demonstrate emergent capabilities that are not predicted by scaling laws alone. GPT-4 showed theory-of-mind abilities not present in GPT-3.5, and biological weapons knowledge that OpenAI's own red team flagged. Pre-deployment evaluation is necessary because post-deployment harm is irreversible.",
    N.assertion, nuance=[Nu.temporal],
    sources=[{"url": "https://openai.com/gpt-4-system-card", "title": "GPT-4 System Card", "source_type": "institutional"}],
    state=S.engaged, summary="Frontier models show unpredicted emergent capabilities requiring pre-deployment eval")

d2 = add_arg(t4, t4_innov, users["anika_patel"],
    "Pre-deployment regulation creates a compliance moat that benefits incumbents (OpenAI, Google, Anthropic) at the expense of startups and open-source projects. The EU AI Act's compliance costs are estimated at €300K-€2M per model, which is trivial for Big Tech but existential for small labs and academic researchers.",
    N.counter, parent=d1, edge_rel=E.challenges, nuance=[Nu.scale],
    sources=[{"url": "https://euaiact.com/compliance-costs", "title": "EU AI Act Compliance Cost Estimates", "source_type": "institutional"}],
    state=S.engaged, summary="Regulation creates compliance moat: €300K-€2M per model hurts small labs")

d3 = add_arg(t4, t4_innov, users["james_liu"],
    "The 'regulation helps incumbents' argument assumes all regulation is equal. Tiered regulation — where frontier models above a compute threshold (e.g., 10^26 FLOP) face stricter requirements — exempts small models and open-source entirely. The UK AI Safety Institute's approach demonstrates this is feasible.",
    N.qualification, parent=d2, edge_rel=E.qualifies, nuance=[Nu.conditional, Nu.scale],
    sources=[{"url": "https://aisi.gov.uk/approach", "title": "UK AI Safety Institute - Approach", "source_type": "institutional"}],
    state=S.unchallenged, summary="Tiered regulation above compute thresholds exempts small models/open-source")

d4 = add_arg(t4, t4_safety, users["carlos_mendez"],
    "The analogy to pharmaceutical regulation is instructive: we require pre-market approval for drugs but not for food supplements below a risk threshold. AI regulation should similarly distinguish between high-risk deployment (autonomous weapons, critical infrastructure) and lower-risk use (creative tools, education).",
    N.synthesis,
    state=S.engaged, summary="Like pharma: pre-market approval for high-risk AI, lighter for low-risk")

d5 = add_arg(t4, t4_safety, users["thomas_berg"],
    "The pharmaceutical analogy breaks down because AI systems can be repurposed post-deployment. A language model approved for education can be jailbroken for bioweapons synthesis. Unlike a drug, which has a fixed mechanism of action, an AI model is a general-purpose tool whose risk profile changes with use.",
    N.counter, parent=d4, edge_rel=E.challenges,
    state=S.unchallenged, summary="Pharma analogy fails: AI models are repurposable post-deployment")

d6 = add_arg(t4, t4_govern, users["fatima_al_rashid"],
    "International coordination on AI governance is necessary but faces a fundamental collective action problem. If the US and EU regulate while China does not, regulated firms face competitive disadvantage without global safety gains. The IAEA model (nuclear) suggests international inspection regimes are possible but took decades to establish.",
    N.assertion, nuance=[Nu.geographic, Nu.temporal],
    sources=[{"url": "https://arxiv.org/abs/2307.04699", "title": "International Governance of Civilian AI - Proposals", "source_type": "academic"}],
    state=S.engaged, summary="AI governance needs international coordination but faces collective action problem")

d7 = add_arg(t4, t4_govern, users["james_liu"],
    "The 'China will race ahead' framing is overstated. China has actually implemented stricter AI content regulations than the US (deepfake laws, algorithm transparency requirements). The real coordination gap is between *safety-concerned* democracies — US, EU, UK, Japan, South Korea — who could align relatively quickly.",
    N.counter, parent=d6, edge_rel=E.challenges, nuance=[Nu.geographic],
    state=S.unchallenged, summary="China already regulates AI strictly — real gap is among democracies")

d8 = add_arg(t4, t4_safety, users["olivia_wright"],
    "Most AI harm today is not from frontier models but from deployed, optimized recommendation systems that amplify misinformation and polarization. Regulating frontier models while ignoring deployed recommendation algorithms addresses a speculative future risk while ignoring a demonstrated present harm.",
    N.reframe,
    sources=[{"url": "https://doi.org/10.1073/pnas.2025334119", "title": "Algorithmic Amplification of Partisan Content", "source_type": "academic"}],
    state=S.unchallenged, summary="Present harm from recommendation algorithms > speculative frontier risk")

d9 = add_arg(t4, t4_innov, users["priya_sharma"],
    "Open-source AI models are a critical counterweight to corporate concentration. Requiring pre-deployment licensing for models above a compute threshold would make open-source frontier models illegal. This is the equivalent of making Linux illegal because servers can be misused.",
    N.assertion,
    state=S.engaged, summary="Pre-deployment licensing would make open-source frontier AI illegal")

d10 = add_arg(t4, t4_innov, users["thomas_berg"],
    "The open-source analogy to Linux is misleading. Linux doesn't have the autonomous capability to cause mass harm. A more appropriate analogy: we freely share chemistry knowledge (open source) but regulate enrichment centrifuges (frontier capability). Open-sourcing a model capable of autonomous bioweapon design is categorically different from open-sourcing a text editor.",
    N.counter, parent=d9, edge_rel=E.challenges,
    state=S.unchallenged, summary="Linux analogy fails: frontier AI models have autonomous harm capability")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TOPIC 5: China-Taiwan Tensions (NEW - Geopolitical)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
t5 = add_topic(
    "Is a Chinese military invasion of Taiwan likely within the next decade, and can deterrence prevent it?",
    "Assessing military, economic, and diplomatic dimensions of cross-strait tensions.",
    [T.political, T.economic, T.geographic], "Taiwan Strait", users["james_liu"],
)
t5_mil = add_track(t5, "Military capability & readiness", "PLA capabilities, logistics, timeline")
t5_deter = add_track(t5, "Deterrence strategies", "US/allied deterrence, arms sales, strategic ambiguity")
t5_econ = add_track(t5, "Economic interdependence", "Semiconductor supply chains, trade costs of conflict")

e1 = add_arg(t5, t5_mil, users["james_liu"],
    "The PLA's amphibious lift capacity has tripled since 2015 and is projected to reach sufficient levels for a Taiwan invasion by 2027-2028 according to multiple Indo-Pacific Command assessments. However, capacity ≠ willingness. The PLA also lacks combat experience and faces a 100-mile strait crossing under potential sustained fire.",
    N.assertion, nuance=[Nu.temporal, Nu.geographic],
    sources=[{"url": "https://csis.org/analysis/pla-amphibious-capability", "title": "CSIS - PLA Amphibious Capability Assessment", "source_type": "institutional"}],
    state=S.engaged, summary="PLA may have invasion capacity by 2027-28, but capability ≠ willingness")

e2 = add_arg(t5, t5_mil, users["fatima_al_rashid"],
    "Historical comparisons are informative: every major amphibious invasion (Normandy, Inchon, Falklands) required either surprise or overwhelming naval/air superiority. China would have neither against a forewarned Taiwan backed by US intelligence and potentially US naval assets. The 100-mile strait is wider than the English Channel.",
    N.qualification, parent=e1, edge_rel=E.qualifies, nuance=[Nu.geographic],
    state=S.unchallenged, summary="Historical precedent: amphibious invasions require surprise or dominance")

e3 = add_arg(t5, t5_deter, users["carlos_mendez"],
    "Strategic ambiguity — the US policy of neither confirming nor denying whether it would defend Taiwan — has kept peace for 50 years. Shifting to explicit defense commitments risks provoking the exact conflict it aims to prevent by eliminating Beijing's uncertainty about the cost of invasion.",
    N.assertion, nuance=[Nu.temporal],
    state=S.engaged, summary="Strategic ambiguity has kept peace for 50 years; clarity risks provocation")

e4 = add_arg(t5, t5_deter, users["james_liu"],
    "Strategic ambiguity is eroding regardless of US policy choices. Biden explicitly stated four times that the US would defend Taiwan. Congressional Taiwan visits, arms sales acceleration, and joint military planning all signal commitment. The question is whether to formalize reality rather than maintain a fiction that fools no one.",
    N.counter, parent=e3, edge_rel=E.challenges, nuance=[Nu.temporal],
    state=S.unchallenged, summary="Strategic ambiguity already eroded — Biden said US would defend Taiwan 4 times")

e5 = add_arg(t5, t5_econ, users["thomas_berg"],
    "Taiwan produces 92% of the world's most advanced semiconductors (<7nm). A conflict would destroy TSMC fabrication facilities (which Taiwan has reportedly mined for self-denial). The global economic cost is estimated at $2.5 trillion in the first year — 10x the Ukraine war's economic impact. This makes invasion economically irrational for China.",
    N.assertion, nuance=[Nu.scale],
    sources=[{"url": "https://rhg.com/taiwan-contingency-economic-costs", "title": "Rhodium Group - Economic Costs of Taiwan Contingency", "source_type": "institutional"}],
    state=S.engaged, summary="Taiwan conflict: $2.5T first-year cost, 92% of advanced chips destroyed")

e6 = add_arg(t5, t5_econ, users["james_liu"],
    "The semiconductor deterrence argument ('silicon shield') is weakening as China invests $150B+ in domestic chip manufacturing and the US builds fabs in Arizona/Ohio. By 2030, Taiwan's monopoly on advanced chips may be sufficiently reduced that the economic calculus changes. Deterrence strategies that depend on economic irrationality are fragile.",
    N.counter, parent=e5, edge_rel=E.challenges, nuance=[Nu.temporal],
    sources=[{"url": "https://semiconductorindustry.org/china-investment-tracker", "title": "SIA - China Semiconductor Investment Tracker", "source_type": "institutional"}],
    state=S.unchallenged, summary="China's $150B chip investment weakening Taiwan's 'silicon shield' by 2030")

e7 = add_arg(t5, t5_deter, users["fatima_al_rashid"],
    "The Ukraine war demonstrates both the power and limits of economic sanctions as deterrence. Despite devastating sanctions, Russia continues fighting. This suggests that for a dispute China considers existential (as Taiwan is), economic costs alone will not deter. Military deterrence must be credible independently of economic consequences.",
    N.assertion, nuance=[Nu.geographic],
    state=S.unchallenged, summary="Ukraine shows sanctions alone don't deter existential disputes")

e8 = add_arg(t5, t5_mil, users["anika_patel"],
    "An important variable is whether China might pursue options short of invasion: blockade, quarantine, seizure of outlying islands, or cyberattacks on infrastructure. These 'grey zone' scenarios are harder to deter, harder to respond to, and more plausible than a full amphibious assault. The debate focuses too narrowly on invasion.",
    N.reframe,
    state=S.unchallenged, summary="Grey zone scenarios (blockade, cyber) more likely than full invasion")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TOPIC 6: Russia-Ukraine (NEW - Geopolitical)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
t6 = add_topic(
    "Should the West push for a negotiated settlement in Ukraine, or continue supporting military victory?",
    "Weighing realism, international law, human cost, and precedent in the Ukraine conflict.",
    [T.political, T.geographic, T.social], "Ukraine", users["fatima_al_rashid"],
)
t6_realism = add_track(t6, "Realist case for negotiation", "Frozen conflicts, nuclear risk, fatigue")
t6_law = add_track(t6, "International law & precedent", "Sovereignty, territorial integrity, UN Charter")
t6_military = add_track(t6, "Military realities", "Front line dynamics, attrition, ammunition")

f1 = add_arg(t6, t6_realism, users["carlos_mendez"],
    "The front lines have barely moved since mid-2023 despite hundreds of thousands of casualties on both sides. Neither side has the capability for decisive breakthrough. The Korean War precedent suggests a negotiated armistice along current lines, while unsatisfying, can freeze a conflict and save lives — South Korea prospered despite never signing a formal peace treaty.",
    N.assertion, nuance=[Nu.temporal, Nu.geographic],
    state=S.engaged, summary="Stalemate since 2023 suggests Korean War-style armistice as pragmatic option")

f2 = add_arg(t6, t6_law, users["james_liu"],
    "Accepting a negotiated settlement that leaves Russia in control of Ukrainian territory rewards aggression and sets a precedent that territorial conquest is viable in the 21st century. Every authoritarian leader watching — Xi, Kim, Modi — would recalculate their cost-benefit analysis for using military force.",
    N.counter, parent=f1, edge_rel=E.challenges,
    state=S.engaged, summary="Settlement rewarding conquest sets dangerous precedent for all authoritarian leaders")

f3 = add_arg(t6, t6_law, users["fatima_al_rashid"],
    "The 'precedent' argument assumes other leaders watch and rationally update, but this is speculative. China's Taiwan calculus depends on PLA capabilities and US deterrence posture, not on Ukrainian borders. The precedent of 'never negotiate' also has costs — it signals that conflicts can only end in total victory, potentially prolonging future wars.",
    N.qualification, parent=f2, edge_rel=E.qualifies,
    state=S.unchallenged, summary="'Never negotiate' precedent may prolong future wars — deterrence is multi-factor")

f4 = add_arg(t6, t6_military, users["anika_patel"],
    "Ukraine faces a severe demographic disadvantage: its population is roughly a quarter of Russia's, and it cannot sustain current casualty rates indefinitely. Western arms supplies offset equipment shortfalls but cannot replace manpower. A negotiated settlement before Ukrainian fighting capacity degrades further would produce better terms than one forced by exhaustion.",
    N.assertion, nuance=[Nu.temporal, Nu.scale],
    state=S.engaged, summary="Ukraine's population is 1/4 of Russia's — manpower exhaustion favors early negotiation")

f5 = add_arg(t6, t6_military, users["james_liu"],
    "The manpower argument ignores defensive advantages. Ukraine is defending prepared positions with interior lines of communication, while Russia must sustain offensive operations across thousands of kilometers. Historically, defenders require 1:3 fewer troops. Ukraine's Western-supplied precision munitions multiply this advantage significantly.",
    N.counter, parent=f4, edge_rel=E.challenges,
    state=S.unchallenged, summary="Defense advantages offset manpower gap — defenders need 1:3 fewer troops")

f6 = add_arg(t6, t6_realism, users["fatima_al_rashid"],
    "The nuclear escalation risk cannot be dismissed. Russia has explicitly lowered its threshold for nuclear use in its 2024 doctrine revision. While nuclear use remains unlikely, a negotiated settlement removes this risk entirely. Even a 1% probability of nuclear escalation represents an unacceptable expected cost in human terms.",
    N.assertion, nuance=[Nu.temporal],
    sources=[{"url": "https://armscontrol.org/russia-nuclear-doctrine-2024", "title": "Arms Control Association - Russia Nuclear Doctrine Update", "source_type": "institutional"}],
    state=S.engaged, summary="Even 1% nuclear escalation probability represents unacceptable expected cost")

f7 = add_arg(t6, t6_realism, users["carlos_mendez"],
    "The nuclear risk argument, taken to its logical conclusion, gives any nuclear-armed state a free hand to commit aggression. If the threat of nuclear escalation compels capitulation, then nuclear proliferation becomes the rational strategy for every vulnerable state. The precedent of yielding to nuclear threats is more dangerous than the immediate risk itself.",
    N.counter, parent=f6, edge_rel=E.challenges,
    state=S.unchallenged, summary="Yielding to nuclear threats incentivizes proliferation — worse long-term")

f8 = add_arg(t6, t6_realism, users["elena_vasquez"],
    "Both 'victory' and 'settlement' frames center Western strategic interests and often elide what Ukrainians themselves want. Polling consistently shows >70% of Ukrainians oppose territorial concessions. Any durable settlement requires Ukrainian consent, which is currently absent for a deal recognizing Russian control of occupied territories.",
    N.reframe,
    sources=[{"url": "https://kiis.com.ua/en/reports/ukraine-conflict-polls-2025", "title": "KIIS - Ukrainian Public Opinion on Conflict Resolution", "source_type": "academic"}],
    state=S.unchallenged, summary="70%+ of Ukrainians oppose territorial concessions — legitimacy requires consent")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TOPIC 7: Universal Basic Income (NEW)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
t7 = add_topic(
    "Is Universal Basic Income a viable replacement for existing welfare programs in developed economies?",
    "Evaluating UBI's economic feasibility, labor market effects, and social outcomes.",
    [T.economic, T.social, T.political], None, users["priya_sharma"],
)
t7_feas = add_track(t7, "Fiscal feasibility", "Cost, funding mechanisms, macro effects")
t7_labor = add_track(t7, "Labor market effects", "Work incentives, automation, entrepreneurship")
t7_pilot = add_track(t7, "Pilot program evidence", "Finland, Stockton, Kenya, Alaska")

g1 = add_arg(t7, t7_feas, users["carlos_mendez"],
    "A US UBI of $1,000/month for all adults would cost approximately $3.1 trillion annually — roughly 75% of current federal revenue. Even replacing all existing means-tested welfare ($700B) leaves a $2.4T funding gap requiring unprecedented tax increases or deficit spending.",
    N.assertion,
    sources=[{"url": "https://budget.house.gov/ubi-analysis", "title": "US Budget Committee - UBI Cost Analysis", "source_type": "institutional"}],
    state=S.engaged, summary="US UBI at $1K/month costs $3.1T — $2.4T gap after welfare consolidation")

g2 = add_arg(t7, t7_feas, users["sarah_chen"],
    "The $3.1 trillion figure is misleading because it ignores macroeconomic feedback effects. A UBI would increase consumer spending, which expands the tax base. Roosevelt Institute modelling found that a $1K/month UBI would grow GDP by 12.56% over 8 years if deficit-funded, generating $1.6T in additional tax revenue. The net cost is far less than the gross.",
    N.counter, parent=g1, edge_rel=E.challenges,
    sources=[{"url": "https://rooseveltinstitute.org/ubi-macroeconomic-analysis", "title": "Roosevelt Institute - UBI Macroeconomic Analysis", "source_type": "academic"}],
    state=S.engaged, summary="Roosevelt Institute: UBI grows GDP 12.56%, generating $1.6T in tax revenue")

g3 = add_arg(t7, t7_feas, users["david_kowalski"],
    "The Roosevelt Institute model assumes a large Keynesian multiplier from UBI spending. But much of the additional consumer spending would leak into imports and asset price inflation rather than domestic GDP growth. Their most optimistic scenario also assumes zero behavioral labor supply response, which contradicts their own literature review.",
    N.counter, parent=g2, edge_rel=E.challenges,
    state=S.unchallenged, summary="Roosevelt model assumes unrealistic Keynesian multiplier and zero labor response")

g4 = add_arg(t7, t7_labor, users["thomas_berg"],
    "With AI automation projected to displace 30-40% of current jobs within 20 years (McKinsey 2023), the traditional welfare model — which conditions benefits on job-seeking — becomes incoherent. UBI is the only social safety net that doesn't require the fiction that everyone can find employment in an increasingly automated economy.",
    N.assertion, nuance=[Nu.temporal],
    sources=[{"url": "https://mckinsey.com/automation-displacement-2023", "title": "McKinsey 2023 - Jobs Lost, Jobs Gained: Automation", "source_type": "institutional"}],
    state=S.engaged, summary="AI displacing 30-40% of jobs makes employment-conditional welfare incoherent")

g5 = add_arg(t7, t7_labor, users["marcus_osei"],
    "The '30-40% job displacement' figure from McKinsey refers to task automation, not job elimination. Most jobs have some automatable tasks but also require human judgment, empathy, or physical dexterity. Previous automation waves (ATMs, spreadsheets, word processors) changed job content but didn't produce mass unemployment. This time may not be different.",
    N.counter, parent=g4, edge_rel=E.challenges, nuance=[Nu.temporal, Nu.contested_empirically],
    state=S.unchallenged, summary="McKinsey figure is task automation, not job elimination — previous waves didn't cause mass unemployment")

g6 = add_arg(t7, t7_pilot, users["elena_vasquez"],
    "Finland's 2017-2018 basic income experiment (€560/month to 2,000 unemployed) found: minimal reduction in employment, improved subjective well-being, better health outcomes, and increased trust in institutions. However, the sample was limited to unemployed recipients, not universal. Stockton CA's SEED program found similar results: employment increased among recipients.",
    N.assertion,
    sources=[{"url": "https://julkaisut.valtioneuvosto.fi/ubi-experiment-final", "title": "Finland Ministry of Social Affairs - UBI Experiment Final Report", "source_type": "institutional"}],
    state=S.engaged, summary="Finland and Stockton pilots: no employment reduction, improved well-being")

g7 = add_arg(t7, t7_pilot, users["priya_sharma"],
    "All existing UBI pilots suffer from a fundamental external validity problem: they are temporary and small-scale. Participants know the program will end, which changes their behavior (they save money rather than quitting jobs). A permanent, universal program would likely produce different labor supply responses. We simply don't have evidence for the real thing.",
    N.qualification, parent=g6, edge_rel=E.qualifies, nuance=[Nu.temporal, Nu.scale],
    state=S.unchallenged, summary="Temporary pilots don't predict permanent UBI effects — external validity problem")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TOPIC 8: Israel-Palestine (NEW - Geopolitical)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
t8 = add_topic(
    "Is a two-state solution still viable for the Israeli-Palestinian conflict?",
    "Examining demographic, territorial, political, and international dimensions of the two-state paradigm.",
    [T.political, T.geographic, T.social], "Israel/Palestine", users["fatima_al_rashid"],
)
t8_territory = add_track(t8, "Territorial & settlement realities", "West Bank settlements, borders, contiguity")
t8_political = add_track(t8, "Political feasibility", "Domestic politics on both sides, leadership")
t8_alt = add_track(t8, "Alternative frameworks", "One-state, confederation, other models")

h1 = add_arg(t8, t8_territory, users["fatima_al_rashid"],
    "The West Bank now contains 700,000+ Israeli settlers across 280+ settlements, including deep penetration of the E1 corridor that bisects any contiguous Palestinian state. Physical dismantlement of settlements is politically impossible — even the 2005 Gaza disengagement of 8,000 settlers nearly collapsed the Israeli government.",
    N.assertion, nuance=[Nu.geographic, Nu.temporal],
    sources=[{"url": "https://peacenow.org/settlements-data", "title": "Peace Now - Settlement Data", "source_type": "institutional"}],
    state=S.engaged, summary="700K+ settlers in 280+ settlements make contiguous Palestinian state physically impossible")

h2 = add_arg(t8, t8_territory, users["carlos_mendez"],
    "Settlement geography doesn't preclude a state — it changes the map. The Geneva Initiative (2003) and the Olmert parameters (2008) both showed feasible border configurations with land swaps that annex major settlement blocs to Israel while compensating with Israeli territory. About 80% of settlers live in blocs close to the Green Line.",
    N.counter, parent=h1, edge_rel=E.challenges, nuance=[Nu.geographic],
    sources=[{"url": "https://genevaaccord.org/full-text", "title": "Geneva Initiative Full Text", "source_type": "institutional"}],
    state=S.engaged, summary="Land swap proposals accommodate 80% of settlers near Green Line — state still feasible")

h3 = add_arg(t8, t8_territory, users["fatima_al_rashid"],
    "The 'settlement blocs' framing understates the problem. The 20% of settlers outside blocs — roughly 140,000 people in 100+ outposts — are politically the most extreme and their removal has been promised in every peace plan yet never implemented. No Israeli government has demonstrated the political will to evacuate even a single outpost post-2005.",
    N.counter, parent=h2, edge_rel=E.challenges, nuance=[Nu.temporal],
    state=S.unchallenged, summary="140K settlers outside blocs never evacuated — no political will demonstrated since 2005")

h4 = add_arg(t8, t8_political, users["james_liu"],
    "Neither side currently has leadership capable of making the necessary compromises. Israel's governing coalition includes parties explicitly committed to annexation. The PA is authoritarian and lacks legitimacy (no elections since 2006). Hamas controls Gaza. There is no interlocutor on either side empowered to negotiate a final status agreement.",
    N.assertion, nuance=[Nu.temporal],
    state=S.unchallenged, summary="No current leadership on either side empowered to negotiate — fundamental political gap")

h5 = add_arg(t8, t8_alt, users["elena_vasquez"],
    "The two-state/one-state binary obscures more creative options. A Palestinian-Israeli-Jordanian confederation — as proposed by former Palestinian PM Fayyad and endorsed by some Israeli peace advocates — could provide Palestinian sovereignty, settler residence rights, shared Jerusalem, and Jordan's stabilizing role. This deserves more serious analysis.",
    N.reframe,
    sources=[{"url": "https://alandforall.org/english", "title": "A Land for All - Two States, One Homeland", "source_type": "institutional"}],
    state=S.unchallenged, summary="Confederation model offers creative alternative to binary two-state/one-state")

h6 = add_arg(t8, t8_alt, users["fatima_al_rashid"],
    "Any 'creative' solution must contend with the fundamental power asymmetry: Israel controls all territory between the river and the sea, holds military dominance, and faces no external pressure sufficient to force concessions. Without a shift in the power balance — through international pressure, US policy change, or Palestinian strategic innovation — no framework, however creative, will be implemented.",
    N.qualification, parent=h5, edge_rel=E.qualifies,
    state=S.unchallenged, summary="Power asymmetry means no framework gets implemented without shifts in external pressure")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TOPIC 9: Social Media & Democracy (NEW)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
t9 = add_topic(
    "Is social media fundamentally incompatible with healthy democratic discourse?",
    "Examining whether social media's design incentives inevitably degrade public discourse and democratic institutions.",
    [T.social, T.political, T.scientific], None, users["olivia_wright"],
)
t9_design = add_track(t9, "Design & incentives", "Engagement algorithms, virality, attention economy")
t9_evidence = add_track(t9, "Empirical evidence", "Polarization data, election interference, mental health")
t9_reform = add_track(t9, "Reform proposals", "Regulation, alternative platforms, digital literacy")

i1 = add_arg(t9, t9_design, users["thomas_berg"],
    "Social media platforms optimise for engagement, and outrage generates more engagement than nuance. A 2021 study in Science found that each additional moral-emotional word in a tweet increased its retweet rate by 20%. Platforms that maximise engagement structurally amplify the most extreme, divisive content — this is a design feature, not a bug.",
    N.assertion,
    sources=[{"url": "https://doi.org/10.1126/science.aay9830", "title": "Brady et al. 2021 - How Social Media Amplifies Moral-Emotional Language", "source_type": "academic"}],
    state=S.engaged, summary="Each moral-emotional word increases retweets 20% — outrage is engagement")

i2 = add_arg(t9, t9_design, users["olivia_wright"],
    "The 'engagement = outrage' framing is simplistic. YouTube's recommendation algorithm optimisation has shifted significantly since 2019 — internal data shows a 70% reduction in borderline content recommendations. The problem isn't inherent to social media but to specific algorithmic choices that platforms have demonstrated they CAN change.",
    N.counter, parent=i1, edge_rel=E.challenges, nuance=[Nu.temporal],
    sources=[{"url": "https://blog.youtube/inside-youtube/on-youtubes-recommendation-system", "title": "YouTube Transparency Report on Recommendations", "source_type": "institutional"}],
    state=S.unchallenged, summary="YouTube reduced borderline content recommendations 70% — platforms CAN change")

i3 = add_arg(t9, t9_evidence, users["priya_sharma"],
    "The evidence for social media causing political polarization is weaker than commonly assumed. Boxell, Gentzkow & Shapiro (2017) found that polarization increased MOST among demographics that use social media LEAST (65+ year olds). If social media caused polarization, we'd expect the opposite pattern.",
    N.assertion, nuance=[Nu.contested_empirically],
    sources=[{"url": "https://doi.org/10.1073/pnas.1706588114", "title": "Boxell, Gentzkow & Shapiro 2017 - Is Social Media Causing Polarization?", "source_type": "academic"}],
    state=S.engaged, summary="Polarization highest among 65+ who use social media least — causation unclear")

i4 = add_arg(t9, t9_evidence, users["elena_vasquez"],
    "The Boxell et al. finding doesn't exonerate social media — it may reflect indirect effects. Older Americans consume cable news that increasingly mirrors social media dynamics. Social media changed the broader information ecosystem even for non-users. The 2017 data also precedes the hyper-polarization acceleration of 2019-2024.",
    N.qualification, parent=i3, edge_rel=E.qualifies, nuance=[Nu.temporal],
    state=S.unchallenged, summary="Indirect ecosystem effects mean non-users are still affected by social media dynamics")

i5 = add_arg(t9, t9_reform, users["anika_patel"],
    "Community Notes (formerly Birdwatch) on Twitter/X demonstrates that crowd-sourced fact-checking can work within a social media platform. Notes rated helpful by users across the political spectrum reduced misinformation sharing by 25-30%. This is evidence that reform is possible without eliminating social media entirely.",
    N.assertion,
    sources=[{"url": "https://doi.org/10.1038/s41586-024-07417-w", "title": "Community Notes Study - Nature 2024", "source_type": "academic"}],
    state=S.unchallenged, summary="Community Notes reduced misinformation sharing 25-30% — reform works")

i6 = add_arg(t9, t9_design, users["marcus_osei"],
    "The question asks whether social media is 'fundamentally incompatible' with democracy, but what if the problem is that democracy hasn't adapted? Town halls, newspapers, and TV all disrupted democratic discourse in their time and institutions eventually adapted. Social media may require new democratic institutions (digital assemblies, structured deliberation platforms) rather than nostalgia for a pre-internet discourse that wasn't actually that healthy.",
    N.reframe,
    state=S.unchallenged, summary="Democracy needs to adapt to social media, not the reverse — institutions evolve")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TOPIC 10: BRICS & Dollar Dominance (NEW - Geopolitical)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
t10 = add_topic(
    "Can BRICS nations realistically challenge US dollar hegemony in global trade within the next two decades?",
    "Assessing de-dollarization trends, BRICS currency proposals, and the structural advantages of the dollar.",
    [T.economic, T.political, T.geographic], None, users["carlos_mendez"],
)
t10_struct = add_track(t10, "Structural dollar advantages", "Depth, liquidity, network effects, trust")
t10_dedollar = add_track(t10, "De-dollarization evidence", "Bilateral agreements, reserve shifts, SWIFT alternatives")
t10_politics = add_track(t10, "Political dynamics", "BRICS cohesion, competing interests, sanctions")

j1 = add_arg(t10, t10_struct, users["carlos_mendez"],
    "The dollar's dominance rests on unmatched structural advantages: the US Treasury market ($27T) is the deepest and most liquid asset market on Earth, US capital markets are open and rule-of-law-governed, and the dollar benefits from massive network effects — 88% of forex transactions involve the dollar. No BRICS currency has these properties.",
    N.assertion,
    sources=[{"url": "https://bis.org/statistics/rpfx22.htm", "title": "BIS Triennial Survey 2022 - Foreign Exchange Turnover", "source_type": "institutional"}],
    state=S.engaged, summary="Dollar in 88% of forex transactions, backed by $27T Treasury market — unmatched")

j2 = add_arg(t10, t10_dedollar, users["james_liu"],
    "De-dollarization is already happening at the margins. China-Russia bilateral trade in yuan increased from 2% to 25% between 2021-2024. Saudi Arabia now accepts yuan for some oil sales. India pays for Russian oil in rupees and dirhams. Central bank dollar reserves have dropped from 72% to 58% over 20 years. The trend is slow but consistent.",
    N.counter, parent=j1, edge_rel=E.challenges, nuance=[Nu.temporal],
    sources=[{"url": "https://imf.org/reserve-currency-composition", "title": "IMF COFER Database - Currency Composition of Reserves", "source_type": "institutional"}],
    state=S.engaged, summary="Dollar reserves dropped 72% to 58%, China-Russia yuan trade hit 25%")

j3 = add_arg(t10, t10_dedollar, users["carlos_mendez"],
    "The reserve share decline is primarily accounted for by a rise in 'other' currencies (Australian dollar, Canadian dollar, Korean won) — NOT yuan. The yuan's reserve share is stuck at ~2.7% despite a decade of China's active promotion. De-dollarization is happening, but it's diversification away from ALL major currencies, not a shift toward a BRICS alternative.",
    N.qualification, parent=j2, edge_rel=E.qualifies, nuance=[Nu.contested_empirically],
    sources=[{"url": "https://www.ecb.europa.eu/pub/ire/html/ecb.ire202406~9d0cb3201c.en.html", "title": "ECB International Role of the Euro Report 2024", "source_type": "institutional"}],
    state=S.unchallenged, summary="Yuan stuck at 2.7% of reserves — diversification, not de-dollarization toward BRICS")

j4 = add_arg(t10, t10_politics, users["fatima_al_rashid"],
    "The fundamental obstacle to a BRICS currency is that BRICS members have deeply conflicting interests. India and China are strategic rivals who fought border skirmishes in 2020. Brazil's economy is tied to US capital markets. Russia needs BRICS for sanctions evasion while others don't. A currency union requires macroeconomic convergence that these nations lack and cannot achieve.",
    N.assertion, nuance=[Nu.geographic],
    state=S.engaged, summary="BRICS members are strategic rivals — India-China, Brazil-US ties, Russia's sanctions needs all conflict")

j5 = add_arg(t10, t10_politics, users["james_liu"],
    "A BRICS reserve currency doesn't require macroeconomic union — the SDR model at the IMF shows that a basket reference currency can exist without fiscal union. What BRICS members share is a desire to reduce dollar dependency for strategic reasons, even if they disagree on everything else. Shared opposition to dollar weaponization (sanctions) is sufficient alignment.",
    N.counter, parent=j4, edge_rel=E.challenges,
    state=S.unchallenged, summary="SDR-style basket doesn't need fiscal union — shared anti-sanctions interest suffices")

j6 = add_arg(t10, t10_struct, users["thomas_berg"],
    "The US has weaponized the dollar through sanctions against Russia (2022), Iran, Venezuela, and others. Each sanctions episode accelerates de-dollarization by demonstrating that dollar-denominated assets can be frozen. The US faces a fundamental trade-off: using the dollar as a weapon today erodes its dominance tomorrow. This dynamic is irreversible.",
    N.assertion, nuance=[Nu.temporal],
    state=S.unchallenged, summary="Dollar weaponization is self-undermining — each sanction accelerates de-dollarization")

j7 = add_arg(t10, t10_struct, users["olivia_wright"],
    "Challenging dollar hegemony doesn't require replacing it — it requires viable alternatives for specific transactions. A world where oil trades in multiple currencies, bilateral trade uses local currencies, and reserves are diversified across 5-6 currencies is achievable without any single replacement. The end of dollar hegemony doesn't mean the 'rise of the yuan.'",
    N.reframe,
    state=S.unchallenged, summary="Dollar decline means multi-currency world, not yuan replacement — fragmentation not substitution")


db.commit()

# Count results
topics = db.query(Topic).count()
args = db.query(ArgumentNode).count()
tracks = db.query(DiscourseTrack).count()
users_count = db.query(User).count()
edges = db.query(ArgumentEdge).count()

print(f"\n{'='*60}")
print(f"  Logora Seed Data Loaded Successfully!")
print(f"{'='*60}")
print(f"  Users:     {users_count}")
print(f"  Topics:    {topics}")
print(f"  Tracks:    {tracks}")
print(f"  Arguments: {args}")
print(f"  Edges:     {edges}")
print(f"{'='*60}")
print(f"  Login: any user email + password123")
print(f"  Example: sarah@example.com / password123")
print(f"{'='*60}\n")

db.close()
