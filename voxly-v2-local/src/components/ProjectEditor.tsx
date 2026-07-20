"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, Cloud } from "lucide-react";

interface ProjectEditorProps {
  projectId: string;
  title: string;
  localVideoPath: string;
  cloudExportUrl: string | null;
  initialBackground: "blur" | "white" | "black";
}

const CAPTION_THEMES = ["hormozi", "boxed", "minimal"] as const;
const CAPTION_COLORS = ["yellow", "white", "green", "cyan", "pink"] as const;

export function ProjectEditor({
  projectId,
  title,
  localVideoPath,
  cloudExportUrl,
  initialBackground,
}: ProjectEditorProps) {
  const [backgroundOption, setBackgroundOption] = React.useState(initialBackground);
  const [theme, setTheme] =
    React.useState<(typeof CAPTION_THEMES)[number]>("hormozi");
  const [textColor, setTextColor] =
    React.useState<(typeof CAPTION_COLORS)[number]>("yellow");
  const [showTitle, setShowTitle] = React.useState(true);
  const [enableZoom, setEnableZoom] = React.useState(true);
  const [enableBroll, setEnableBroll] = React.useState(true);
  const [focalYOffset, setFocalYOffset] = React.useState(0);
  const [renderStatus, setRenderStatus] = React.useState<
    "idle" | "rendering" | "done" | "error"
  >(cloudExportUrl ? "done" : "idle");
  const [cloudUrl, setCloudUrl] = React.useState(cloudExportUrl);
  const [errorMessage, setErrorMessage] = React.useState("");

  // Always play the local file in the editor; the cloud URL is only used as a
  // share/download link (and may be unreachable if R2 public access isn't set up).
  const previewSrc = localVideoPath || cloudUrl;

  async function pollRenderUntilDone() {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const res = await fetch(`/api/render/status?projectId=${projectId}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.success && data.completed) {
        setCloudUrl(data.cloudExportUrl || null);
        return true;
      }
    }
    return false;
  }

  async function handleRender() {
    setRenderStatus("rendering");
    setErrorMessage("");

    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          backgroundOption,
          theme,
          textColor,
          showTitle,
          enableZoom,
          enableBroll,
          focalYOffset,
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

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        All projects
      </Link>

      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-xs text-zinc-500 mt-1">Podcast-style render → Cloudflare R2</p>
      </div>

      <div className="aspect-[9/16] max-w-sm mx-auto rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800">
        <video src={previewSrc ?? undefined} controls className="w-full h-full object-contain" />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-400 uppercase">Background</p>
          <div className="flex gap-2">
            {(["blur", "white", "black"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setBackgroundOption(opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                  backgroundOption === opt
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-400 uppercase">Caption theme</p>
          <div className="flex gap-2">
            {CAPTION_THEMES.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setTheme(opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                  theme === opt
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-400 uppercase">Highlight color</p>
          <div className="flex gap-2">
            {CAPTION_COLORS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setTextColor(opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                  textColor === opt
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Title", value: showTitle, set: setShowTitle },
            { label: "Zoom", value: enableZoom, set: setEnableZoom },
            { label: "B-roll", value: enableBroll, set: setEnableBroll },
          ].map(({ label, value, set }) => (
            <button
              key={label}
              type="button"
              onClick={() => set(!value)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between ${
                value
                  ? "bg-violet-600/20 text-violet-200 border border-violet-500/40"
                  : "bg-zinc-900 text-zinc-400 border border-zinc-800"
              }`}
            >
              {label}
              <span className="text-[10px]">{value ? "ON" : "OFF"}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-zinc-400 uppercase">Vertical framing</p>
            <span className="text-[10px] font-mono text-zinc-500">
              Auto face-track on render · manual:{" "}
              {focalYOffset > 0 ? "down" : focalYOffset < 0 ? "up" : "center"}
            </span>
          </div>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.1}
            value={focalYOffset}
            onChange={(e) => setFocalYOffset(parseFloat(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
          />
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={renderStatus === "rendering"}
          onClick={handleRender}
        >
          {renderStatus === "rendering" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Rendering & uploading to R2…
            </>
          ) : (
            "Render & upload to cloud"
          )}
        </Button>

        {renderStatus === "error" && errorMessage && (
          <p className="text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </p>
        )}

        {cloudUrl && (
          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20 space-y-2">
            <p className="text-xs text-emerald-400 font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              On cloud (R2)
            </p>
            <a
              href={cloudUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-violet-300 break-all hover:underline flex items-start gap-2"
            >
              <Cloud className="h-4 w-4 shrink-0 mt-0.5" />
              {cloudUrl}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
