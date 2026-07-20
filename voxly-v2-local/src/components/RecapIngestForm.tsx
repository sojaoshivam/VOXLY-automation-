"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileVideo,
  Loader2,
  AlertCircle,
  ArrowRight,
  Clapperboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type UploadStep = "idle" | "uploading" | "transcribing" | "done" | "error";

export function RecapIngestForm() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [videoFile, setVideoFile] = React.useState<File | null>(null);
  const [step, setStep] = React.useState<UploadStep>("idle");
  const [errorMessage, setErrorMessage] = React.useState("");

  function getCleanTitle(filename: string) {
    return filename
      .replace(/\.[^/.]+$/, "")
      .replace(/[_-]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setVideoFile(file);
      if (!title.trim()) setTitle(getCleanTitle(file.name));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !videoFile) {
      setErrorMessage("Please provide a title and a movie clip (MP4, max 60s).");
      return;
    }

    setErrorMessage("");
    setStep("uploading");

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("video", videoFile);

      const uploadRes = await fetch("/api/recap/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }

      const uploadData = await uploadRes.json();
      const projectId = uploadData.project.id as string;

      setStep("transcribing");
      const transcribeRes = await fetch("/api/recap/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!transcribeRes.ok) {
        const err = await transcribeRes.json();
        throw new Error(err.error || "Transcription failed");
      }

      setStep("done");
      router.push(`/projects/${projectId}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }

  const isBusy = step === "uploading" || step === "transcribing";

  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Clapperboard className="h-5 w-5 text-amber-400" />
          Movie clip ingest
        </CardTitle>
        <CardDescription>
          Upload one scene clip (≤60s). Voxly transcribes dialogue, then you generate an AI recap script and Sarvam voiceover.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase">Project title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Inception hallway scene"
              className="bg-zinc-900 border-zinc-800"
              disabled={isBusy}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase">Movie clip (MP4)</label>
            <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-10 cursor-pointer hover:border-amber-500/40 transition-colors">
              <UploadCloud className="h-8 w-8 text-zinc-500" />
              <div className="text-center">
                <p className="text-sm text-zinc-300">
                  {videoFile ? videoFile.name : "Drop MP4 or click to browse"}
                </p>
                <p className="text-xs text-zinc-500 mt-1">Max 60 seconds · locally sourced only</p>
              </div>
              <input
                type="file"
                accept="video/mp4,video/*"
                className="hidden"
                onChange={handleVideoChange}
                disabled={isBusy}
              />
            </label>
            {videoFile && (
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <FileVideo className="h-3.5 w-3.5" />
                {(videoFile.size / (1024 * 1024)).toFixed(1)} MB selected
              </p>
            )}
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {errorMessage}
            </div>
          )}

          <Button
            type="submit"
            disabled={isBusy || !videoFile || !title.trim()}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold"
          >
            {step === "uploading" && (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Uploading clip…
              </>
            )}
            {step === "transcribing" && (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Transcribing dialogue…
              </>
            )}
            {(step === "idle" || step === "error" || step === "done") && (
              <>
                Start movie recap
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
