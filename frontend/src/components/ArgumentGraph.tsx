import { useState, useMemo, useCallback } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, Node, Edge, NodeProps,
  Handle, Position, MarkerType, ReactFlowProvider,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { GraphNode, GraphEdge, NodeType, EdgeRelationship, DiscourseTrack } from "../types";
import { ChevronDown, ChevronRight, Maximize2 } from "lucide-react";

export const NODE_COLORS: Record<NodeType, { bg: string; border: string; text: string; accent: string }> = {
  assertion:     { bg: "#1e1b4b", border: "#6366f1", text: "#c7d2fe", accent: "#6366f1" },
  counter:       { bg: "#450a0a", border: "#ef4444", text: "#fecaca", accent: "#ef4444" },
  qualification: { bg: "#451a03", border: "#f59e0b", text: "#fde68a", accent: "#f59e0b" },
  exception:     { bg: "#431407", border: "#f97316", text: "#fed7aa", accent: "#f97316" },
  synthesis:     { bg: "#052e16", border: "#22c55e", text: "#bbf7d0", accent: "#22c55e" },
  reframe:       { bg: "#3b0764", border: "#a855f7", text: "#e9d5ff", accent: "#a855f7" },
  open_question: { bg: "#1a1d23", border: "#6b7080", text: "#9ca0ab", accent: "#6b7080" },
  concession:    { bg: "#042f2e", border: "#14b8a6", text: "#99f6e4", accent: "#14b8a6" },
};

const EDGE_COLORS: Record<EdgeRelationship, string> = {
  supports:    "#22c55e",
  challenges:  "#ef4444",
  qualifies:   "#f59e0b",
  refines:     "#6366f1",
  contradicts: "#dc2626",
  synthesizes: "#14b8a6",
  questions:   "#6b7080",
};

const NODE_W = 260;
const NODE_H = 140;

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 40, marginx: 30, marginy: 30 });
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.target, e.source));
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

function getChildIds(nodeId: string, edges: GraphEdge[]): string[] {
  return edges.filter((e) => e.target === nodeId).map((e) => e.source);
}

function getAllDescendants(nodeId: string, edges: GraphEdge[]): Set<string> {
  const result = new Set<string>();
  const queue = getChildIds(nodeId, edges);
  while (queue.length) {
    const cur = queue.shift()!;
    if (!result.has(cur)) {
      result.add(cur);
      getChildIds(cur, edges).forEach((c) => queue.push(c));
    }
  }
  return result;
}

interface NodeData {
  graphNode: GraphNode;
  childCount: number;
  collapsed: boolean;
  onToggle: (id: string) => void;
  onNodeClick: (id: string) => void;
}

function ArgumentNodeCard({ data }: NodeProps<NodeData>) {
  const { graphNode: n, childCount, collapsed, onToggle, onNodeClick } = data;
  const c = NODE_COLORS[n.node_type] ?? NODE_COLORS.assertion;
  const hasChildren = childCount > 0;
  const displayText = n.ai_summary ?? (n.content.length > 85 ? n.content.slice(0, 85) + "\u2026" : n.content);

  return (
    <div
      onClick={() => onNodeClick(n.id)}
      style={{
        background: "#13161a",
        border: `1.5px solid ${c.border}`,
        borderLeft: `3px solid ${c.border}`,
        borderRadius: 8,
        width: NODE_W,
        fontFamily: "Inter, system-ui, sans-serif",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: c.border, width: 8, height: 8, border: "2px solid #0d0f11" }} />

      <div style={{ padding: "6px 10px", borderBottom: `1px solid ${c.border}30`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: c.accent, fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {n.node_type.replace("_", " ")}
        </span>
        <div style={{ display: "flex", gap: 3 }}>
          {n.nuance_tags.slice(0, 2).map((tag) => (
            <span key={tag} style={{ background: "#22262e", color: "#9ca0ab", fontSize: 9, padding: "1px 5px", borderRadius: 4, fontWeight: 500 }}>
              {tag.replace(/_/g, " ")}
            </span>
          ))}
          {n.sources_count > 0 ? (
            <span style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 9, padding: "1px 5px", borderRadius: 4, fontWeight: 500 }}>
              {n.sources_count} src
            </span>
          ) : n.node_type === "assertion" && (
            <span style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontSize: 9, padding: "1px 5px", borderRadius: 4, fontWeight: 500 }}>
              unverified
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: "8px 10px", minHeight: 48 }}>
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: "#e2e4e9" }}>{displayText}</p>
        {n.ai_summary && (
          <p style={{ margin: "3px 0 0", fontSize: 9, color: "#6b7080", fontStyle: "italic" }}>click to see full argument</p>
        )}
      </div>

      <div style={{ padding: "5px 10px 6px", borderTop: "1px solid #22262e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 10, color: "#6b7080" }}>
          <span style={{ color: "#9ca0ab", fontWeight: 500 }}>{n.author_display_name}</span>
          {n.track_name && <span style={{ color: c.accent, marginLeft: 4 }}>{"\u00b7"} {n.track_name}</span>}
        </div>
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(n.id); }}
            style={{
              background: collapsed ? c.accent : "#22262e",
              color: collapsed ? "#fff" : "#9ca0ab",
              border: "none", borderRadius: 4, padding: "2px 8px",
              fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center",
              gap: 2, fontWeight: 600,
            }}
          >
            {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
            {collapsed ? `+${childCount}` : `${childCount}`}
          </button>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: c.border, width: 8, height: 8, border: "2px solid #0d0f11" }} />
    </div>
  );
}

const RF_NODE_TYPES = { argument: ArgumentNodeCard };

interface Props {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  tracks: DiscourseTrack[];
  onNodeClick?: (nodeId: string) => void;
  onExpand?: () => void;
}

function GraphInner({ graphNodes, graphEdges, tracks, onNodeClick, onExpand }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filterTrack, setFilterTrack] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const { visibleNodes, visibleEdges } = useMemo(() => {
    let filtered = graphNodes;
    if (filterTrack !== "all") filtered = filtered.filter((n) => n.track_id === filterTrack);
    if (filterType !== "all") filtered = filtered.filter((n) => n.node_type === filterType);
    const visibleIds = new Set(filtered.map((n) => n.id));
    collapsed.forEach((cid) => {
      getAllDescendants(cid, graphEdges).forEach((d) => visibleIds.delete(d));
    });
    return {
      visibleNodes: filtered.filter((n) => visibleIds.has(n.id)),
      visibleEdges: graphEdges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
    };
  }, [graphNodes, graphEdges, collapsed, filterTrack, filterType]);

  const handleNodeClick = useCallback((id: string) => { onNodeClick?.(id); }, [onNodeClick]);

  const rfNodes: Node[] = useMemo(() => {
    const rawEdges: Edge[] = visibleEdges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
    const raw: Node[] = visibleNodes.map((n) => ({
      id: n.id, type: "argument", position: { x: 0, y: 0 },
      data: {
        graphNode: n,
        childCount: getChildIds(n.id, graphEdges).filter((c) => visibleNodes.some((v) => v.id === c)).length,
        collapsed: collapsed.has(n.id), onToggle: toggleCollapse, onNodeClick: handleNodeClick,
      },
    }));
    return applyDagreLayout(raw, rawEdges);
  }, [visibleNodes, visibleEdges, collapsed, toggleCollapse, graphEdges, handleNodeClick]);

  const rfEdges: Edge[] = useMemo(() =>
    visibleEdges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      label: e.relationship_type,
      animated: ["challenges", "contradicts"].includes(e.relationship_type),
      style: { stroke: EDGE_COLORS[e.relationship_type] ?? "#6b7080", strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS[e.relationship_type] ?? "#6b7080", width: 12, height: 12 },
      labelStyle: { fontSize: 9, fill: "#9ca0ab", fontWeight: 500 },
      labelBgStyle: { fill: "rgba(19,22,26,0.95)" },
      labelBgPadding: [3, 5] as [number, number],
      labelBgBorderRadius: 4,
    })),
    [visibleEdges]
  );

  if (graphNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-text-tertiary gap-2">
        <p className="text-sm">Submit the first argument to see the graph.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-2.5 bg-surface-2 border-b border-border-subtle text-xs shrink-0">
        <span className="text-text-tertiary font-medium">Filter:</span>
        <select value={filterTrack} onChange={(e) => setFilterTrack(e.target.value)}
          className="border border-border-subtle rounded-md px-2.5 py-1.5 text-xs bg-surface-1 text-text-secondary focus:outline-none focus:border-accent/50">
          <option value="all">All tracks</option>
          {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="border border-border-subtle rounded-md px-2.5 py-1.5 text-xs bg-surface-1 text-text-secondary focus:outline-none focus:border-accent/50">
          <option value="all">All types</option>
          {(Object.keys(NODE_COLORS) as NodeType[]).map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
        </select>
        <span className="ml-auto text-text-tertiary">{rfNodes.length} nodes</span>
        {onExpand && (
          <button onClick={onExpand} className="flex items-center gap-1 text-accent hover:text-accent-hover font-medium transition" title="Expand to fullscreen">
            <Maximize2 size={11} /> Focus Mode
          </button>
        )}
        {collapsed.size > 0 && (
          <button onClick={() => setCollapsed(new Set())} className="text-accent hover:text-accent-hover font-medium transition">Expand all</button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 400 }}>
        <ReactFlow nodes={rfNodes} edges={rfEdges} nodeTypes={RF_NODE_TYPES}
          fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.15} maxZoom={2}
          attributionPosition="bottom-right">
          <Background color="#2a2f38" gap={20} size={1} />
          <Controls showInteractive={false} style={{ borderRadius: 6, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }} />
          <MiniMap
            nodeColor={(n) => NODE_COLORS[n.data?.graphNode?.node_type as NodeType]?.accent ?? "#6b7080"}
            maskColor="rgba(13,15,17,0.85)"
            style={{ border: "1px solid #2a2f38", borderRadius: 6 }}
          />
        </ReactFlow>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-2.5 border-t border-border-subtle text-xs shrink-0">
        {(Object.entries(NODE_COLORS) as [NodeType, typeof NODE_COLORS[NodeType]][]).map(([type, c]) => (
          <div key={type} className="flex items-center gap-1 text-text-tertiary">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.bg, border: `1px solid ${c.border}` }} />
            <span>{type.replace("_", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ArgumentGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
