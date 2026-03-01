import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTopic } from "../api/client";
import { TopicTag } from "../types";
import { ArrowLeft } from "lucide-react";

const ALL_TAGS: TopicTag[] = ["geographic", "social", "economic", "scientific", "political", "environmental"];

const TAG_COLORS: Record<string, string> = {
  geographic:    "bg-sky-500/15 text-sky-400 border-sky-500/30",
  social:        "bg-violet-500/15 text-violet-400 border-violet-500/30",
  economic:      "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  scientific:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  political:     "bg-rose-500/15 text-rose-400 border-rose-500/30",
  environmental: "bg-teal-500/15 text-teal-400 border-teal-500/30",
};

export function CreateTopic() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [selectedTags, setSelectedTags] = useState<TopicTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleTag = (tag: TopicTag) => {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const topic = await createTopic({
        canonical_question: question,
        description: description || undefined,
        tags: selectedTags,
        location: location || undefined,
      });
      navigate(`/topics/${topic.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Failed to create topic.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-10 animate-fade-in">
      <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-secondary transition mb-6">
        <ArrowLeft size={14} /> Back
      </button>

      <h1 className="text-xl font-semibold text-text-primary mb-1">New debate</h1>
      <p className="text-sm text-text-tertiary mb-6">Frame a clear, neutral question for structured discourse.</p>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5 animate-slide-up">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Question <span className="text-red-400">*</span>
          </label>
          <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Is gentrification net harmful to low-income urban residents?"
            className="input-field" required />
          <p className="text-xs text-text-tertiary mt-1.5">Phrase as a neutral question.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Description</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide context..." className="input-field resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Location</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Chicago, IL" className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Tags</label>
          <div className="flex flex-wrap gap-2">
            {ALL_TAGS.map((tag) => (
              <button key={tag} type="button" onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                  selectedTags.includes(tag)
                    ? (TAG_COLORS[tag] ?? "bg-surface-3 text-text-secondary border-border") + " ring-1 ring-accent/50"
                    : (TAG_COLORS[tag] ?? "bg-surface-3 text-text-secondary border-border") + " opacity-50 hover:opacity-80"
                }`}
              >{tag}</button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 animate-slide-down">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate("/")} className="btn-ghost px-4 py-2 rounded-lg text-sm">Cancel</button>
          <button type="submit" disabled={loading} className="px-5 py-2 btn-primary rounded-lg text-sm">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </span>
            ) : "Create debate"}
          </button>
        </div>
      </form>
    </div>
  );
}
