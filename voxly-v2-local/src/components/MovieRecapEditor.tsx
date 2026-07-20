"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Cloud,
  Sparkles,
  Mic,
  FileText,
  Clapperboard,
} from "lucide-react";
import { ScriptEditorPanel } from "@/components/ScriptEditorPanel";
import type { RecapScriptData } from "@/lib/recap-types";
import { parseRecapScript } from "@/lib/recap-types";

interface MovieRecapEditorProps {
  projectId: string;
  title: string;
  localVideoPath: string;
  cloudExportUrl: string | null;
  sourceTranscriptData: string | null;
  recapScriptData: string | null;
  commentaryAudioPath: string | null;
  transcriptData: string | null;
}

const CAPTION_THEMES = ["hormozi", "boxed", "minimal"] as const;
const CAPTION_COLORS = ["yellow", "white", "green", "cyan", "pink"] as const;

export function MovieRecapEditor({
  projectId,
  title,
  localVideoPath,
  cloudExportUrl,
  sourceTranscriptData,
  recapScriptData: initialScriptJson,
  commentaryAudioPath,
  transcriptData,
}: MovieRecapEditorProps) {
  const [script, setScript] = React.useState<RecapScriptData | null>(
    parseRecapScript(initialScriptJson)
  );
  const [theme, setTheme] =
    React.useState<(typeof CAPTION_THEMES)[number]>("hormozi");
  const [textColor, setTextColor] =
    React.useState<(typeof CAPTION_COLORS)[number]>("yellow");
  const [showTitle, setShowTitle] = React.useState(true);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [renderStatus, setRenderStatus] = React.useState<
    "idle" | "rendering" | "done" | "error"
  >(cloudExportUrl ? "done" : "idle");
  const [cloudUrl, setCloudUrl] = React.useState(cloudExportUrl);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [voicePath, setVoicePath] = React.useState(commentaryAudioPath);
  const [hasVoiceTranscript, setHasVoiceTranscript] = React.useState(Boolean(transcriptData));

  async function pollRenderUntilDone() {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const res = await fetch(`/api/recap/render/status?projectId=${projectId}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.success && data.completed) {
        setCloudUrl(data.cloudExportUrl || null);
        return true;
      }
      if (data.status === "failed") return false;
    }
    return false;
  }

  async function runAction(action: string, fn: () => Promise<void>) {
    setBusyAction(action);
    setErrorMessage("");
    try {
      await fn();
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleGenerateScript() {
    await runAction("script", async () => {
      const res = await fetch("/api/recap/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Script generation failed");
      }
      const data = await res.json();
      setScript(data.script);
    });
  }

  async function handleSaveScript() {
    if (!script) return;
    await runAction("save", async () => {
      const res = await fetch("/api/recap/script", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, script }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save script");
      }
    });
  }

  async function handleGenerateVoice() {
    await runAction("voice", async () => {
      if (script) {
        const saveRes = await fetch("/api/recap/script", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, script }),
        });
        if (!saveRes.ok) {
          const err = await saveRes.json();
          throw new Error(err.error || "Failed to save script");
        }
      }

      const res = await fetch("/api/recap/generate-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Voice generation failed");
      }
      const data = await res.json();
      setVoicePath(data.commentaryAudioPath);

      const trRes = await fetch("/api/recap/transcribe-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!trRes.ok) {
        const err = await trRes.json();
        throw new Error(err.error || "Voiceover transcription failed");
      }
      setHasVoiceTranscript(true);
    });
  }

  async function handleRender() {
    setRenderStatus("rendering");
    setErrorMessage("");

    try {
      const res = await fetch("/api/recap/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          theme,
          textColor,
          showTitle,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Render failed");
      }

      const done = await pollRenderUntilDone();
      if (!done) throw new Error("Render timed out. Check server logs.");
      setRenderStatus("done");
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Render failed");
      setRenderStatus("error");
    }
  }

  const canGenerateScript = Boolean(sourceTranscriptData);
  const canGenerateVoice = Boolean(script?.segments?.length);
  const canRender = hasVoiceTranscript && Boolean(voicePath);

  return (
    <div className="space-y-6">
      <Link
        href="/projects?type=movie"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Movie projects
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50">
            Movie
          </span>
        </div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-xs text-zinc-500 mt-1">
          AI recap script → Sarvam voice → render → Cloudflare R2
        </p>
      </div>

      <div className="aspect-[9/16] max-w-sm mx-auto rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800">
        <video src={localVideoPath} controls className="w-full h-full object-contain" />
      </div>

      {voicePath && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-2">
          <p className="text-xs font-bold text-zinc-400 uppercase flex items-center gap-2">
            <Mic className="h-3.5 w-3.5" />
            Sarvam voiceover preview
          </p>
          <audio src={voicePath} controls className="w-full" />
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-zinc-400 uppercase flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            Recap script
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canGenerateScript || busyAction !== null}
              onClick={handleGenerateScript}
              className="border-zinc-700 text-zinc-200"
            >
              {busyAction === "script" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Generate
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!script || busyAction !== null}
              onClick={handleSaveScript}
              className="bg-zinc-800 hover:bg-zinc-700"
            >
              Save
            </Button>
          </div>
        </div>

        <ScriptEditorPanel
          script={script}
          onChange={setScript}
          disabled={busyAction !== null}
        />

        <Button
          type="button"
          disabled={!canGenerateVoice || busyAction !== null}
          onClick={handleGenerateVoice}
          className="w-full bg-amber-600 hover:bg-amber-500"
        >
          {busyAction === "voice" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Generating Sarvam voice…
            </>
          ) : (
            <>
              <Mic className="h-4 w-4 mr-2" />
              Generate voiceover (Sarvam)
            </>
          )}
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-5">
        <p className="text-xs font-bold text-zinc-400 uppercase">Caption style</p>
        <div className="flex flex-wrap gap-2">
          {CAPTION_THEMES.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setTheme(opt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                theme === opt
                  ? "bg-amber-600 text-white"
                  : "bg-zinc-900 text-zinc-400 border border-zinc-800"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {CAPTION_COLORS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setTextColor(opt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                textColor === opt
                  ? "bg-amber-600 text-white"
                  : "bg-zinc-900 text-zinc-400 border border-zinc-800"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={showTitle}
            onChange={(e) => setShowTitle(e.target.checked)}
            className="rounded border-zinc-700"
          />
          Show title bar
        </label>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {errorMessage}
        </div>
      )}

      <Button
        type="button"
        disabled={!canRender || renderStatus === "rendering"}
        onClick={handleRender}
        className="w-full bg-violet-600 hover:bg-violet-500 font-bold"
      >
        {renderStatus === "rendering" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Rendering movie recap…
          </>
        ) : (
          <>
            <Clapperboard className="h-4 w-4 mr-2" />
            Render vertical short
          </>
        )}
      </Button>

      {renderStatus === "done" && cloudUrl && (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 space-y-2">
          <p className="text-sm text-emerald-300 flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Uploaded to R2
          </p>
          <a
            href={cloudUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-emerald-400 hover:underline break-all flex items-center gap-1"
          >
            <Cloud className="h-3.5 w-3.5 shrink-0" />
            {cloudUrl}
          </a>
        </div>
      )}
    </div>
  );
}
