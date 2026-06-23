# Core Engine

> Defines what Crux is optimizing for, how "debate progress" is measured, and the assumptions the architecture depends on.

---

## Primary Objective

Crux optimizes for **knowledge compression**: turning a messy, evolving debate into a compact, navigable map of the strongest claims, key disagreements, and unresolved points.

Deliberation quality is a **secondary objective** that serves the primary one. Better reasoning produces better maps, but the system measures success by the quality of the compressed output, not by the process alone.

### Why knowledge compression is primary

1. It is **observable** — you can compare the graph state against the raw discussion and ask "does this map capture what matters?"
2. It is **useful to newcomers** — a new participant can read the graph and know exactly where they can contribute without repeating established ground.
3. It **compounds** — each well-compressed debate makes the next one easier (cross-topic linking, accumulated precedents).

### How the two objectives coexist

| Objective | Role | Measured by |
|-----------|------|-------------|
| Knowledge compression | Primary output | Graph coverage, redundancy rate, newcomer orientation time |
| Deliberation quality | Enabling input | Argument specificity, response relevance, concession rate |

Deliberation quality is pursued insofar as it improves compression. If contributors produce vague or circular arguments, the graph cannot compress them meaningfully, so the system incentivizes specificity and genuine engagement.

---

## Defining "Debate Progress"

"Debate progress" is defined operationally as **reduction in unresolved semantic territory**.

A debate makes progress when:

1. **Coverage increases** — a new argument addresses a dimension of the question that was previously unrepresented in the graph.
2. **Redundancy decreases** — a duplicate or rehash is caught and merged rather than added as a new node.
3. **Resolution increases** — a node transitions from `unchallenged` → `engaged` → `refined` or `conceded`, or a `synthesis` node successfully integrates multiple positions.
4. **Specificity increases** — vague claims get replaced or refined into conditional, scoped, or empirically grounded versions (tracked via nuance tags).
5. **Open questions close** — an `open_question` node receives a substantive response that addresses it.

### Progress metrics (observable)

| Metric | Definition | Good signal |
|--------|-----------|-------------|
| **Compression ratio** | Unique semantic positions / total contributions | Higher is better |
| **State advancement rate** | % of nodes that have moved beyond `unchallenged` | Higher is better |
| **Synthesis coverage** | % of opposing position-pairs that have at least one synthesis attempt | Higher is better |
| **Duplicate intercept rate** | % of near-duplicates caught before posting | Higher is better |
| **Dormancy ratio** | % of nodes in `dormant` state | Lower is better (active debates) |

### What is NOT progress

- More nodes without new semantic content (volume without coverage)
- Deeper reply chains that do not refine the parent claim
- Agreement without specificity ("I agree" nodes that add nothing)

---

## The Graph: Representation Layer, Reasoning Layer, or Both

**Decision: The graph is primarily a representation layer with lightweight reasoning affordances.**

### What this means

The graph captures **reply structure and semantic type** — who responded to whom, and what kind of move they made (counter, qualification, synthesis, etc.). It does not attempt to model:

- Formal logical entailment
- Probability or confidence distributions
- Causal dependency chains
- Truth values of propositions

### Why not a full reasoning layer

1. **Debates are not proofs.** Most real disagreements involve empirical uncertainty, value conflicts, and frame disagreements that cannot be resolved by logical inference alone.
2. **Brittleness.** A formal reasoning layer would require perfect classification of argument types and relationships. Misclassification (which is inevitable with ML) would produce meaningfully wrong inferences.
3. **User hostility.** Requiring contributors to formalize their arguments would create friction that prevents participation.

### Lightweight reasoning affordances the graph does provide

| Affordance | Mechanism |
|-----------|-----------|
| Contradiction detection | Two nodes both classified as `assertion` connected by a `contradicts` edge |
| Subsumption | `synthesis` nodes that reference multiple positions |
| Gap identification | Regions of the graph with `open_question` nodes and no responses |
| Staleness detection | Nodes in `dormant` state indicating abandoned lines of argument |
| Convergence signal | High ratio of `concession` and `synthesis` nodes relative to `counter` nodes |

These are **heuristic** signals, not logical conclusions. The system surfaces them to users but does not enforce them as ground truth.

---

## What ML/AI Is Expected to Evaluate

### AI CAN reliably evaluate

| Task | Confidence | Why |
|------|-----------|-----|
| **Node type classification** | High | Distinguishing "this is a counter-argument" from "this is a qualification" is a well-defined NLP task with strong inter-annotator agreement. |
| **Semantic similarity / duplicate detection** | High | Embedding-based similarity is well-understood and the threshold can be tuned empirically. |
| **Neutral summarization** | Medium-High | LLMs produce good summaries when the source material is structured. The graph structure helps. |
| **Edge relationship classification** | Medium | Determining whether an argument "supports" vs "qualifies" another is harder but still tractable with context. |
| **Gap identification** | Medium | Identifying what hasn't been said requires reasoning about the space of possible arguments, which LLMs can approximate given a well-defined question. |

### AI CANNOT reliably evaluate

| Task | Why it fails |
|------|-------------|
| **Argument correctness / truth** | The system cannot and should not adjudicate factual disputes. It can flag claims as `contested_empirically` but cannot determine who is right. |
| **Argument quality (deep)** | Surface quality (specificity, sourcing) is measurable; actual reasoning validity requires domain expertise the model may lack. |
| **Good faith vs. bad faith** | Intent is not observable from text alone. Sophisticated bad-faith actors can produce text that scores well on all surface metrics. |
| **Credibility of sources** | The system can check whether sources are cited, but evaluating source reliability requires domain-specific judgment. |
| **Value alignment** | Disagreements rooted in different values (liberty vs. equality, individual vs. collective) have no "correct" answer that AI can discover. |
| **When a debate is "settled"** | Settlement is a social judgment, not a logical one. The system can report convergence signals but cannot declare resolution. |

### Design implications

1. **AI classifies; humans judge.** The system uses AI for structural classification and pattern detection, never for determining who is right.
2. **Graceful degradation.** All AI features have stub fallbacks. The platform must remain useful without AI scoring.
3. **Transparency.** AI-generated labels (node type, relationship type) should be visible and editable by the author.
4. **No hidden scoring that determines visibility.** Unlike social media algorithms, the graph structure is the primary organizer, not an opaque relevance score.

---

## Core Architecture Assumptions

### Assumption 1: Typed argument graphs capture meaningful debate structure

**Claim:** Modeling arguments as typed nodes with typed edges captures something useful that flat threads do not.

**Evidence for:**
- Academic argumentation theory (Toulmin model, IBIS) validates the existence of distinct argument types.
- User testing of graph views shows faster orientation than thread reading for complex debates.
- Duplicate detection works better with typed structure than with flat text.

**Evidence against:**
- Many real arguments are ambiguous in type (is it a counter or a qualification?).
- Forcing a type at submission time adds friction.

**Confidence: HIGH.** Even with imperfect classification, the structure adds navigational value. Misclassified nodes still appear in the correct reply position; only the semantic label is wrong.

**Mitigation:** Allow post-hoc reclassification by authors and community consensus.

---

### Assumption 2: AI can classify argument types with acceptable accuracy

**Claim:** LLMs can assign node types and edge relationships with enough accuracy to be useful.

**Evidence for:**
- Zero-shot classification of argument types on debate datasets shows 75-85% agreement with human annotators.
- The system only needs to distinguish 8 node types, not perform fine-grained reasoning.

**Evidence against:**
- Edge cases (counter vs. qualification, synthesis vs. reframe) have low inter-annotator agreement even among humans.
- Accuracy may drop on domain-specific or highly technical debates.

**Confidence: MEDIUM-HIGH.** Acceptable for a navigational aid; not acceptable if classification drives hard decisions (visibility, credibility scoring).

**Mitigation:** AI classification is a suggestion. Authors confirm or override. Credibility scoring uses type distribution patterns, not individual classifications.

---

### Assumption 3: Semantic similarity can detect duplicates before posting

**Claim:** Embedding-based similarity, combined with graph context, can catch rehashed arguments before they enter the graph.

**Evidence for:**
- Standard embedding similarity works well for near-paraphrases.
- Graph context (which claim is being responded to) narrows the search space significantly.

**Evidence against:**
- Semantically similar arguments may have meaningfully different nuance.
- False positives (blocking novel arguments) are more harmful than false negatives (allowing duplicates).

**Confidence: MEDIUM.** The system should flag likely duplicates but never block submission.

**Mitigation:** Duplicate check is advisory only. Shows similar existing arguments and lets the user decide whether to proceed.

---

### Assumption 4: Debates can be meaningfully compressed into graph summaries

**Claim:** The graph structure, combined with AI summarization, can produce a useful compressed representation of a debate's current state.

**Evidence for:**
- Structured input produces better summaries than unstructured text.
- The node type taxonomy directly maps to common summary sections (positions, objections, open questions).

**Evidence against:**
- Important context may live in the nuance of how something was said, not just what was said.
- Compression inherently loses information; the question is whether the loss is acceptable.

**Confidence: HIGH** for debates with >10 nodes. Lower confidence for small or highly technical debates where every detail matters.

**Mitigation:** Summaries always link back to source nodes. Users can drill from summary → full argument.

---

### Assumption 5: Progress can be measured without determining truth

**Claim:** The system can meaningfully track debate progress (coverage, resolution, specificity) without knowing which arguments are correct.

**Evidence for:**
- The progress metrics defined above are structural (state transitions, synthesis coverage, dormancy) not epistemic (who is right).
- This mirrors how academic peer review tracks "has this been addressed?" without judging correctness.

**Evidence against:**
- Users may interpret structural progress signals as epistemic ones ("the system says this is settled" → "the system says X is true").
- Circular arguments that formally tick all boxes (responses, syntheses) could appear as progress.

**Confidence: MEDIUM-HIGH.** The distinction is maintainable if the UI is careful about language.

**Mitigation:** Never use language like "settled" or "resolved" — use "extensively discussed" or "multiple synthesis attempts." Always show that progress metrics are structural, not truth claims.

---

### Assumption 6: The graph is resistant to gaming at the structural level

**Claim:** While individual arguments can be low-quality, the graph structure makes gaming harder than in flat platforms.

**Evidence for:**
- Typed contributions require more effort than untyped comments.
- Duplicate detection catches simple repetition.
- Credibility scoring penalizes patterns (all assertions, no concessions) rather than individual posts.

**Evidence against:**
- Sophisticated actors can produce formally well-typed arguments that satisfy structural requirements while degrading actual discussion quality.
- Coordinated groups can create artificial synthesis/concession patterns.

**Confidence: LOW-MEDIUM.** The system raises the floor of discourse quality but is not robust against determined adversaries.

**Mitigation:** This is explicitly a known limitation. The system optimizes for genuine participants and accepts that adversarial gaming is possible. Community moderation and reputation systems provide additional defense layers.

---

## Observable Success Criteria

The platform is working if:

1. **Newcomer orientation time decreases** — a user joining a 50+ node debate can identify the key positions and open questions in under 2 minutes using the graph view.
2. **Duplicate rate stays low** — fewer than 10% of submitted arguments are near-duplicates of existing nodes.
3. **State machine advances** — more than 60% of nodes in active debates move beyond `unchallenged` within 7 days.
4. **Synthesis emerges** — debates with >20 nodes produce at least one `synthesis` node per 10 opposing position-pairs.
5. **Graph RAG produces grounded answers** — queries about debate state return answers traceable to specific nodes, not hallucinated claims.

---

## Summary of Decisions

| Question | Decision |
|----------|----------|
| What is the primary objective? | Knowledge compression |
| What is the secondary objective? | Deliberation quality (in service of compression) |
| What is "debate progress"? | Reduction in unresolved semantic territory |
| Is the graph a representation or reasoning layer? | Primarily representation, with lightweight reasoning heuristics |
| What can AI evaluate? | Structure, similarity, summarization — not truth, quality, or intent |
| Strongest assumption? | Typed graphs add navigational value (Assumption 1) |
| Weakest assumption? | Gaming resistance at structural level (Assumption 6) |
| Observable success metric? | Newcomer orientation time on 50+ node debates |
