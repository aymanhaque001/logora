import { NodeType } from "../types";

export const NODE_TYPES: NodeType[] = [
  "assertion", "counter", "qualification", "exception",
  "synthesis", "reframe", "open_question", "concession",
];

export const NODE_TYPE_DESCRIPTIONS: Record<NodeType, string> = {
  assertion:     "A claim or statement of fact that can be evaluated.",
  counter:       "A direct challenge or rebuttal to an existing argument.",
  qualification: "Adds conditions or limits to an argument's validity.",
  exception:     "Notes cases where an argument does not apply.",
  synthesis:     "Combines or reconciles multiple viewpoints.",
  reframe:       "Reframes the discussion from a different perspective.",
  open_question: "Poses a question that needs to be addressed.",
  concession:    "Acknowledges the validity of an opposing point.",
};

const TYPE_COLORS: Record<NodeType, string> = {
  assertion:     "bg-indigo-500/15 text-indigo-400",
  counter:       "bg-red-500/15 text-red-400",
  qualification: "bg-amber-500/15 text-amber-400",
  exception:     "bg-orange-500/15 text-orange-400",
  synthesis:     "bg-emerald-500/15 text-emerald-400",
  reframe:       "bg-purple-500/15 text-purple-400",
  open_question: "bg-surface-3 text-text-tertiary",
  concession:    "bg-teal-500/15 text-teal-400",
};

export function NodeTypeBadge({ type }: { type: NodeType }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded ${TYPE_COLORS[type]}`}>
      {type.replace("_", " ")}
    </span>
  );
}
