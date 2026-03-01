import { CatchUpData } from "../types";
import {
  X, Sparkles, CheckCircle2, XCircle, Swords,
  Lightbulb, Users, MessageSquare, ChevronRight,
} from "lucide-react";

interface Props {
  catchUp: CatchUpData;
  onClose: () => void;
  onNavigateToArgument: (argumentId: string) => void;
}

export function CatchUpModal({ catchUp, onClose, onNavigateToArgument }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-1 border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col mx-4 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-accent/15 rounded-md">
              <Sparkles size={16} className="text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Catch Up on This Debate</h2>
              <p className="text-[10px] text-text-tertiary mt-0.5">
                {catchUp.total_nodes} arguments · {catchUp.total_participants} participants
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-surface-3 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Summary */}
          <div>
            <p className="text-xs text-text-secondary leading-relaxed">{catchUp.summary}</p>
            {catchUp.ai_powered && (
              <div className="flex items-center gap-1.5 mt-2 text-[10px] text-violet-400">
                <Sparkles size={10} /> AI-powered summary
              </div>
            )}
          </div>

          {/* Established Points */}
          {catchUp.established_points.length > 0 && (
            <Section
              icon={<CheckCircle2 size={13} className="text-emerald-400" />}
              title="Established"
              subtitle="Widely accepted points"
            >
              {catchUp.established_points.map((pt, i) => (
                <div key={i} className="bg-emerald-500/5 border border-emerald-500/15 rounded-md p-3">
                  <p className="text-xs text-text-primary font-medium">{pt.claim}</p>
                  <p className="text-[11px] text-text-tertiary mt-1">{pt.basis}</p>
                </div>
              ))}
            </Section>
          )}

          {/* Refuted Points */}
          {catchUp.refuted_points.length > 0 && (
            <Section
              icon={<XCircle size={13} className="text-red-400" />}
              title="Refuted"
              subtitle="Successfully challenged"
            >
              {catchUp.refuted_points.map((pt, i) => (
                <div key={i} className="bg-red-500/5 border border-red-500/15 rounded-md p-3">
                  <p className="text-xs text-text-primary line-through opacity-60">{pt.claim}</p>
                  <p className="text-[11px] text-text-tertiary mt-1">{pt.rebuttal}</p>
                </div>
              ))}
            </Section>
          )}

          {/* Active Debates */}
          {catchUp.active_debates.length > 0 && (
            <Section
              icon={<Swords size={13} className="text-amber-400" />}
              title="Still Contested"
              subtitle="Active discussions"
            >
              {catchUp.active_debates.map((debate, i) => (
                <div key={i} className="bg-amber-500/5 border border-amber-500/15 rounded-md p-3">
                  <p className="text-xs text-text-primary font-medium">{debate.topic}</p>
                  <p className="text-[11px] text-text-tertiary mt-1">{debate.sides}</p>
                </div>
              ))}
            </Section>
          )}

          {/* Contribution Opportunities */}
          {catchUp.contribution_opportunities.length > 0 && (
            <Section
              icon={<Lightbulb size={13} className="text-accent" />}
              title="Where You Can Contribute"
              subtitle="Jump in here"
            >
              {catchUp.contribution_opportunities.map((opp, i) => (
                <div key={i} className="bg-accent/5 border border-accent/15 rounded-md p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium mb-1.5 ${
                        opp.opportunity_type === "gap"
                          ? "bg-violet-500/15 text-violet-400"
                          : opp.opportunity_type === "unchallenged_claim"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-blue-500/15 text-blue-400"
                      }`}>
                        {opp.opportunity_type === "gap" ? "Gap" :
                         opp.opportunity_type === "unchallenged_claim" ? "Unchallenged" :
                         "Unanswered"}
                      </span>
                      <p className="text-xs text-text-secondary">{opp.suggestion}</p>
                    </div>
                    {opp.argument_id && (
                      <button
                        onClick={() => {
                          onNavigateToArgument(opp.argument_id);
                          onClose();
                        }}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-accent/15 text-accent rounded-md hover:bg-accent/25 transition-colors"
                      >
                        Respond <ChevronRight size={11} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Empty state */}
          {catchUp.total_nodes === 0 && (
            <div className="text-center py-6">
              <MessageSquare size={20} className="text-text-tertiary mx-auto mb-2 opacity-40" />
              <p className="text-xs text-text-tertiary">No arguments yet. Be the first to contribute!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
            <Users size={10} />
            {catchUp.total_participants} participant{catchUp.total_participants !== 1 ? "s" : ""} so far
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-accent text-white rounded-md hover:bg-accent/90 transition-colors"
          >
            Dive In
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <div>
          <h3 className="text-[11px] font-semibold text-text-primary uppercase tracking-wider">{title}</h3>
          <p className="text-[10px] text-text-tertiary">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
