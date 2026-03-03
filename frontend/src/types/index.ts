export type NodeType =
  | 'assertion'
  | 'counter'
  | 'qualification'
  | 'exception'
  | 'synthesis'
  | 'reframe'
  | 'open_question'
  | 'concession'

export type NuanceTag =
  | 'temporal'
  | 'geographic'
  | 'scale'
  | 'conditional'
  | 'population_specific'
  | 'contested_empirically'

export type ArgumentState =
  | 'unchallenged'
  | 'engaged'
  | 'refined'
  | 'branched'
  | 'merged'
  | 'conceded'
  | 'dormant'

export type EdgeRelationship =
  | 'supports'
  | 'challenges'
  | 'qualifies'
  | 'refines'
  | 'contradicts'
  | 'synthesizes'
  | 'questions'

export type TopicTag =
  | 'geographic'
  | 'social'
  | 'economic'
  | 'scientific'
  | 'political'
  | 'environmental'

export type TopicStatus = 'active' | 'cooling' | 'historical'

export interface User {
  id: string
  email: string
  username: string
  display_name: string
  credibility_score: number
  is_verified_expert: boolean
  expert_domain: string | null
  created_at: string
}

export interface Topic {
  id: string
  canonical_question: string
  description: string | null
  tags: TopicTag[]
  location: string | null
  status: TopicStatus
  created_by: string
  created_at: string
  creator: User
  node_count: number
  track_count: number
  participant_count: number
  last_activity: string | null
}

export interface DiscourseTrack {
  id: string
  topic_id: string
  name: string
  description: string | null
  auto_detected: boolean
  created_at: string
  node_count: number
}

export interface SourceItem {
  url?: string
  title: string
  description?: string
  source_type: string
}

export interface ArgumentNode {
  id: string
  topic_id: string
  track_id: string | null
  parent_id: string | null
  author_id: string
  content: string
  node_type: NodeType
  nuance_tags: NuanceTag[]
  sources: SourceItem[]
  state: ArgumentState
  ai_classification_confidence: number | null
  ai_suggested_track: string | null
  ai_summary: string | null
  created_at: string
  updated_at: string
  author: User
  children_count: number
}

export interface GraphNode {
  id: string
  topic_id: string
  content: string
  ai_summary: string | null
  node_type: NodeType
  state: ArgumentState
  nuance_tags: NuanceTag[]
  author_display_name: string
  track_id: string | null
  track_name: string | null
  sources_count: number
  children_count: number
  created_at: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  relationship_type: EdgeRelationship
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface TopicConnection {
  id: string
  from_topic_id: string
  to_topic_id: string
  from_node_id: string | null
  to_node_id: string | null
  relationship_type: string
  description: string | null
  created_by: string
  created_at: string
  from_topic_question: string
  to_topic_question: string
}

export interface MeshGraphEdge {
  id: string
  source: string
  target: string
  relationship_type: string
  is_cross_topic: boolean
}

export interface MeshGraphData {
  nodes: GraphNode[]
  edges: MeshGraphEdge[]
  topic_labels: Record<string, string>
}

export interface BriefingData {
  summary: string
  key_positions: Array<{
    position: string
    core_claim: string
    strength: 'strong' | 'moderate' | 'weak'
  }>
  unaddressed_nodes: ArgumentNode[]
  track_summaries: Array<{
    track_id: string
    track_name: string
    node_count: number
    unchallenged_count: number
  }>
  discourse_health: {
    total_nodes: number
    sourced_ratio: number
    engagement_ratio: number
    unaddressed_count: number
    engagement_quality?: string
    nuance_present?: boolean
    echo_chamber_risk?: string
    assessment?: string
  }
  total_nodes: number
  total_tracks: number
  last_activity: string | null
  ai_powered: boolean
  main_areas_of_contention: string[]
  what_has_been_left_unaddressed: string
}

export interface ContributionOpportunity {
  argument_id: string | null
  content_snippet: string
  opportunity_type: 'gap' | 'unchallenged_claim' | 'unanswered_question'
  suggestion: string
}

export interface CatchUpData {
  is_newcomer: boolean
  established_points: Array<{ claim: string; basis: string }>
  refuted_points: Array<{ claim: string; rebuttal: string }>
  active_debates: Array<{ topic: string; sides: string }>
  contribution_opportunities: ContributionOpportunity[]
  summary: string
  total_nodes: number
  total_participants: number
  ai_powered: boolean
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

export interface DebateSuggestion {
  canonical_question: string
  description: string
  tags: string[]
  location: string | null
  source_article: string
  source_url: string
  timeliness: 'breaking' | 'recent' | 'ongoing'
  ai_framed: boolean
}

export interface NewsArticle {
  title: string
  body: string
  url: string
  source: string
  date: string
  category: string
  image?: string
}

export interface DuplicateCheckResult {
  is_duplicate: boolean
  confidence: number
  similar_arguments: Array<{
    id: string
    content_preview: string
    similarity: number
  }>
  explanation: string
  suggestion: string | null
  ai_powered: boolean
}

export interface RAGQueryResult {
  answer: string
  context_used: number
  retrieval_stats?: {
    vector_count: number
    graph_count: number
    merged_count: number
    unique_from_graph: number
  }
  ai_powered: boolean
}
