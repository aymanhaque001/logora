import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('logora_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api

// ── Auth ──────────────────────────────────────────────────────────────────────
export const registerUser = (data: {
  email: string
  username: string
  display_name: string
  password: string
}) => api.post('/users/register', data).then((r) => r.data)

export const loginUser = (data: { email: string; password: string }) =>
  api.post('/users/login', data).then((r) => r.data)

export const getMe = () => api.get('/users/me').then((r) => r.data)

// ── Topics ────────────────────────────────────────────────────────────────────
export const getTopics = (params?: {
  search?: string
  tag?: string
  status?: string
}) => api.get('/topics', { params: params ?? {} }).then((r) => r.data)

export const getTopic = (id: string) =>
  api.get(`/topics/${id}`).then((r) => r.data)

export const createTopic = (data: {
  canonical_question: string
  description?: string
  tags?: string[]
  location?: string
}) => api.post('/topics', data).then((r) => r.data)

export const updateTopic = (
  id: string,
  data: {
    canonical_question?: string
    description?: string
    tags?: string[]
    location?: string
  },
) => api.patch(`/topics/${id}`, data).then((r) => r.data)

export const deleteTopic = (id: string) => api.delete(`/topics/${id}`)

export const archiveTopic = (id: string) =>
  api.post(`/topics/${id}/archive`).then((r) => r.data)

// ── Tracks ────────────────────────────────────────────────────────────────────
export const getTracks = (topicId: string) =>
  api.get(`/topics/${topicId}/tracks`).then((r) => r.data)

export const createTrack = (
  topicId: string,
  data: { name: string; description?: string },
) => api.post(`/topics/${topicId}/tracks`, data).then((r) => r.data)

// ── Arguments ─────────────────────────────────────────────────────────────────
export const getArguments = (topicId: string, trackId?: string) =>
  api
    .get(`/topics/${topicId}/arguments`, {
      params: trackId ? { track_id: trackId } : {},
    })
    .then((r) => r.data)

export const submitArgument = (
  topicId: string,
  data: {
    content: string
    node_type: string
    sources?: object[]
    nuance_tags?: string[]
    parent_id?: string
    track_id?: string
    edge_relationship?: string
  },
) => api.post(`/topics/${topicId}/arguments`, data).then((r) => r.data)

export const updateArgument = (
  topicId: string,
  argumentId: string,
  data: { content?: string; nuance_tags?: string[]; sources?: object[] },
) =>
  api
    .patch(`/topics/${topicId}/arguments/${argumentId}`, data)
    .then((r) => r.data)

export const deleteArgument = (topicId: string, argumentId: string) =>
  api.delete(`/topics/${topicId}/arguments/${argumentId}`)

export const transitionArgumentState = (
  topicId: string,
  argumentId: string,
  data: { new_state: string; reason?: string },
) =>
  api
    .post(`/topics/${topicId}/arguments/${argumentId}/transition`, data)
    .then((r) => r.data)

export const getAvailableTransitions = (topicId: string, argumentId: string) =>
  api
    .get(`/topics/${topicId}/arguments/${argumentId}/transitions`)
    .then((r) => r.data)

export const getGraph = (topicId: string) =>
  api.get(`/topics/${topicId}/arguments/graph`).then((r) => r.data)

// ── Briefing ──────────────────────────────────────────────────────────────────
export const getBriefing = (topicId: string) =>
  api.get(`/topics/${topicId}/briefing`).then((r) => r.data)

// ── Catch-Up ──────────────────────────────────────────────────────────────────
export const getCatchUp = (topicId: string) =>
  api.get(`/topics/${topicId}/catch-up`).then((r) => r.data)

// ── Web Search Suggestions ───────────────────────────────────────────────────
export const getDebateSuggestions = (params?: {
  category?: string
  q?: string
  limit?: number
}) => api.get('/suggestions', { params: params ?? {} }).then((r) => r.data)

// ── Duplicate Detection (Graph RAG) ─────────────────────────────────────────
export const checkDuplicate = (topicId: string, content: string) =>
  api
    .post(`/topics/${topicId}/arguments/check-duplicate`, { content })
    .then((r) => r.data)

// ── RAG Query ────────────────────────────────────────────────────────────────
export const ragQuery = (topicId: string, query: string) =>
  api
    .post(`/topics/${topicId}/arguments/rag-query`, { query })
    .then((r) => r.data)

// ── Vector Store Backfill ────────────────────────────────────────────────────
export const backfillVectors = (topicId: string) =>
  api.post(`/topics/${topicId}/arguments/backfill-vectors`).then((r) => r.data)
