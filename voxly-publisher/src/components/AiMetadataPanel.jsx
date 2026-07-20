"use client";

import { useState } from "react";
import { Hash, Sparkles, Wand2 } from "lucide-react";

export default function AiMetadataPanel({
  projectId,
  hasTranscript,
  onApply,
  description,
  hashtags,
  onDescriptionChange,
  onHashtagsChange,
}) {
  const [seedKeywords, setSeedKeywords] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function runAction(action, payload = {}) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI request failed");
      onApply(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="voxly-card rounded-2xl border border-[var(--voxly-line)] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--voxly-muted)]">
            AI Assistant
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--voxly-ink)]">
            Generate & optimize metadata
          </h2>
          <p className="mt-2 text-sm text-[var(--voxly-muted)]">
            Create engaging titles, captions, and tags from your transcript or refine what you&apos;ve written.
          </p>
        </div>
        <Sparkles className="h-5 w-5 shrink-0 text-[var(--voxly-accent)]" />
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-[#f4c7c3] bg-[#fff0ed] px-3 py-2 text-sm text-[var(--voxly-danger)]">
          {error}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!hasTranscript || busy}
          onClick={() => runAction("generate-metadata")}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--voxly-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#184bcc] disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {busy === "generate-metadata" ? "Generating…" : "Auto-generate all"}
        </button>
        <button
          type="button"
          disabled={!description?.trim() || busy}
          onClick={() => runAction("improve-caption", { caption: description })}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--voxly-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--voxly-ink)] hover:bg-[var(--voxly-canvas)] disabled:opacity-50"
        >
          <Wand2 className="h-4 w-4" />
          {busy === "improve-caption" ? "Improving…" : "Improve caption"}
        </button>
      </div>

      {!hasTranscript && (
        <p className="mt-3 text-xs text-[var(--voxly-muted)]">
          No transcript on this project — auto-generate requires transcript data from voxly-v2-local.
        </p>
      )}

      <div className="mt-5 rounded-xl border border-[var(--voxly-line)] bg-[var(--voxly-canvas)] p-4">
        <label className="voxly-label flex items-center gap-1">
          <Hash className="h-3.5 w-3.5" />
          Keyword-driven tags
        </label>
        <p className="mt-1 text-xs text-[var(--voxly-muted)]">
          Enter a few seed keywords and AI will expand them into high-reach YouTube tags.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="voxly-input flex-1"
            value={seedKeywords}
            onChange={(e) => setSeedKeywords(e.target.value)}
            placeholder="e.g. productivity, morning routine, habits"
          />
          <button
            type="button"
            disabled={!seedKeywords.trim() || busy}
            onClick={() => runAction("generate-tags", { keywords: seedKeywords })}
            className="rounded-xl bg-[var(--voxly-ink)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a2927] disabled:opacity-50"
          >
            {busy === "generate-tags" ? "Generating…" : "Generate tags"}
          </button>
        </div>
      </div>
    </section>
  );
}
