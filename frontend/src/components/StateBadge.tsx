import { ArgumentState } from "../types";

const STATE_STYLES: Record<ArgumentState, { dot: string; text: string }> = {
  unchallenged: { dot: "bg-text-tertiary",  text: "text-text-tertiary" },
  engaged:      { dot: "bg-blue-400",       text: "text-blue-400" },
  refined:      { dot: "bg-indigo-400",     text: "text-indigo-400" },
  branched:     { dot: "bg-purple-400",     text: "text-purple-400" },
  merged:       { dot: "bg-amber-400",      text: "text-amber-400" },
  conceded:     { dot: "bg-teal-400",       text: "text-teal-400" },
  dormant:      { dot: "bg-surface-4",      text: "text-text-tertiary" },
};

export function StateBadge({ state }: { state: ArgumentState }) {
  const cfg = STATE_STYLES[state] ?? STATE_STYLES.unchallenged;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {state}
    </span>
  );
}
