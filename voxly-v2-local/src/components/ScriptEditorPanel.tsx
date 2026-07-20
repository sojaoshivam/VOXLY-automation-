"use client";

import * as React from "react";
import type { RecapScriptData, RecapScriptSegment } from "@/lib/recap-types";

type ScriptEditorPanelProps = {
  script: RecapScriptData | null;
  onChange: (script: RecapScriptData) => void;
  disabled?: boolean;
};

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ScriptEditorPanel({ script, onChange, disabled }: ScriptEditorPanelProps) {
  if (!script?.segments?.length) {
    return (
      <p className="text-sm text-zinc-500">
        No recap script yet. Generate one from the clip transcript.
      </p>
    );
  }

  function updateSegment(index: number, narration: string) {
    if (!script) return;
    const segments = script.segments.map((seg, i) =>
      i === index ? { ...seg, narration } : seg
    );
    onChange({ ...script, segments });
  }

  return (
    <div className="space-y-4">
      {script.segments.map((seg: RecapScriptSegment, index: number) => (
        <div
          key={seg.id}
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-amber-400 uppercase">
              Segment {index + 1}
            </span>
            <span className="text-xs text-zinc-500">
              {formatTime(seg.sourceStartSec)} – {formatTime(seg.sourceEndSec)}
            </span>
          </div>
          <textarea
            value={seg.narration}
            onChange={(e) => updateSegment(index, e.target.value)}
            disabled={disabled}
            rows={3}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 resize-y min-h-[72px] focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </div>
      ))}
    </div>
  );
}
