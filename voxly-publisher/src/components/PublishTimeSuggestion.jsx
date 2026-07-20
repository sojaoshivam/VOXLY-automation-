"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Lightbulb } from "lucide-react";

export default function PublishTimeSuggestion({ platforms, onApplyTime }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qs = platforms?.length ? `?platforms=${platforms.join(",")}` : "";
    fetch(`/api/publish-time${qs}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [platforms]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--voxly-line)] bg-[var(--voxly-canvas)] px-4 py-3 text-sm text-[var(--voxly-muted)]">
        Loading publish time suggestions…
      </div>
    );
  }

  if (!data?.primary) return null;

  const localTime = data.primary.suggestedAt
    ? new Date(data.primary.suggestedAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : data.primary.label;

  function toDatetimeLocal(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return (
    <div className="rounded-xl border border-[#b9c7ff] bg-[var(--voxly-accent-soft)] p-4">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-[var(--voxly-accent)]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--voxly-ink)]">Best time to publish</p>
          <p className="mt-1 text-sm text-[var(--voxly-muted)]">
            Suggested: <strong className="text-[var(--voxly-ink)]">{localTime}</strong> (
            {data.primary.platform})
          </p>
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-[var(--voxly-muted)]">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {data.primary.tip}
          </p>
          {onApplyTime && data.primary.suggestedAt && (
            <button
              type="button"
              onClick={() => onApplyTime(toDatetimeLocal(data.primary.suggestedAt))}
              className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[var(--voxly-accent)] shadow-sm hover:bg-[#f5f8ff]"
            >
              Use suggested time
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
