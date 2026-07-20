"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarClock,
  Camera,
  Check,
  ImagePlus,
  Lock,
  Send,
  Shield,
  Video,
} from "lucide-react";
import AiMetadataPanel from "@/components/AiMetadataPanel";
import PublishTimeSuggestion from "@/components/PublishTimeSuggestion";

const PLATFORMS = [
  { key: "youtube", label: "YouTube Shorts", Icon: Video, accent: "text-[#d92d20]" },
  { key: "instagram", label: "Instagram Reels", Icon: Camera, accent: "text-[#c11574]" },
];
const CATEGORIES = ["Short-form", "Education", "Product", "Announcement"];
const VISIBILITY_OPTIONS = ["Public", "Private", "Unlisted"];
const FRAME_OPTIONS = ["00:02", "00:05", "00:09"];

function buildCaption(title, description) {
  return [title, description].filter(Boolean).join("\n\n");
}

function getResultClasses(type) {
  if (type === "error") {
    return "border-[var(--voxly-danger)]/40 bg-[var(--voxly-danger-soft)] text-[var(--voxly-danger)]";
  }
  return "border-[var(--voxly-success)]/40 bg-[var(--voxly-success-soft)] text-[var(--voxly-success)]";
}

function capitalizeVisibility(value) {
  if (!value) return "Public";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export default function PublishComposer({
  project,
  connectedPlatforms,
  savedMetadata,
  hasTranscript,
  defaults,
  aiAutoGenerate,
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(connectedPlatforms);
  const [form, setForm] = useState({
    title: savedMetadata?.title || project.title || "",
    description: savedMetadata?.caption || "",
    category: defaults?.defaultCategory || CATEGORIES[0],
    visibility: capitalizeVisibility(defaults?.defaultVisibility) || VISIBILITY_OPTIONS[0],
    releaseMode: "now",
    scheduledAt: "",
    hashtags: savedMetadata?.hashtags || "#Shorts",
  });
  const [selectedFrame, setSelectedFrame] = useState(FRAME_OPTIONS[0]);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    return () => {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    };
  }, [thumbnailPreview]);

  useEffect(() => {
    if (!aiAutoGenerate || !hasTranscript || savedMetadata?.aiGeneratedAt) return;

    fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate-metadata", projectId: project.id }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.title || data.caption || data.hashtags) handleAiApply(data);
      })
      .catch(() => {});
  }, [aiAutoGenerate, hasTranscript, project.id, savedMetadata?.aiGeneratedAt]);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleAiApply(data) {
    if (data.title) updateForm("title", data.title);
    if (data.caption) updateForm("description", data.caption);
    if (data.hashtags) updateForm("hashtags", data.hashtags);
  }

  function togglePlatform(key) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  }

  function handleThumbnail(file) {
    if (!file) return;
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailPreview(URL.createObjectURL(file));
  }

  async function submit() {
    const mode = form.releaseMode === "schedule" ? "schedule" : "now";

    if (selected.length === 0) {
      setResult({ type: "error", msg: "Select at least one connected platform." });
      return;
    }
    if (!form.title.trim()) {
      setResult({ type: "error", msg: "Add a video title before publishing." });
      return;
    }
    if (mode === "schedule" && !form.scheduledAt) {
      setResult({ type: "error", msg: "Choose a release date and time." });
      return;
    }

    setBusy(true);
    setResult(null);

    const endpoint = mode === "now" ? "/api/publish" : "/api/schedule";
    const body = {
      projectId: project.id,
      platforms: selected,
      caption: buildCaption(form.title.trim(), form.description.trim()),
      hashtags: form.hashtags,
      category: form.category,
      visibility: form.visibility.toLowerCase(),
      ...(mode === "schedule" ? { scheduledAt: new Date(form.scheduledAt).toISOString() } : {}),
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      if (mode === "now") {
        const failed = data.results.filter((r) => r.status === "failed");
        setResult(
          failed.length
            ? { type: "error", msg: `Some destinations failed: ${failed.map((f) => `${f.platform} (${f.error})`).join("; ")}` }
            : { type: "success", msg: "Publication is live." }
        );
      } else {
        setResult({ type: "success", msg: "Publication scheduled." });
      }
      router.refresh();
    } catch (err) {
      setResult({ type: "error", msg: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <section className="rounded-2xl border border-[var(--voxly-line)] bg-[var(--voxly-panel)] p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            {["Source", "Metadata", "Thumbnail", "Release"].map((step, index) => (
              <span
                key={step}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--voxly-line)] bg-[var(--voxly-panel-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--voxly-muted)]"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--voxly-panel)] text-[11px] text-[var(--voxly-muted)]">
                  {index + 1}
                </span>
                {step}
              </span>
            ))}
          </div>
        </section>

        <AiMetadataPanel
          projectId={project.id}
          hasTranscript={hasTranscript}
          description={form.description}
          hashtags={form.hashtags}
          onDescriptionChange={(v) => updateForm("description", v)}
          onHashtagsChange={(v) => updateForm("hashtags", v)}
          onApply={handleAiApply}
        />

        <section className="rounded-2xl border border-[var(--voxly-line)] bg-[var(--voxly-panel)] p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--voxly-muted)]">
                Metadata
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--voxly-ink)]">
                Publication details
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--voxly-success)]/40 bg-[var(--voxly-success-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--voxly-success)]">
              <Check className="h-3.5 w-3.5" />
              Source ready
            </span>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--voxly-muted)]">
                Video title
              </label>
              <input
                className="voxly-input mt-2 w-full"
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                placeholder="Video title"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--voxly-muted)]">
                Description
              </label>
              <textarea
                className="voxly-input mt-2 min-h-32 w-full resize-y"
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                placeholder="Describe the video for publishing."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--voxly-muted)]">
                  Category
                </label>
                <select
                  className="voxly-input mt-2 w-full"
                  value={form.category}
                  onChange={(event) => updateForm("category", event.target.value)}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--voxly-muted)]">
                  Hashtags
                </label>
                <input
                  className="voxly-input mt-2 w-full"
                  value={form.hashtags}
                  onChange={(event) => updateForm("hashtags", event.target.value)}
                  placeholder="#Shorts #voxly"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--voxly-line)] bg-[var(--voxly-panel)] p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--voxly-muted)]">
                Thumbnail
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--voxly-ink)]">
                Select the publication image
              </h2>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--voxly-line-strong)] bg-[var(--voxly-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--voxly-muted)] transition-colors hover:bg-[var(--voxly-canvas)]">
              <ImagePlus className="h-3.5 w-3.5" />
              Upload
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => handleThumbnail(event.target.files?.[0])}
              />
            </label>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {FRAME_OPTIONS.map((frame) => (
              <button
                key={frame}
                type="button"
                onClick={() => {
                  setSelectedFrame(frame);
                  if (thumbnailPreview) {
                    URL.revokeObjectURL(thumbnailPreview);
                    setThumbnailPreview("");
                  }
                }}
                className={`relative aspect-video overflow-hidden rounded-xl border text-left ${
                  selectedFrame === frame && !thumbnailPreview
                    ? "border-[var(--voxly-accent)] ring-2 ring-[var(--voxly-accent)]/25"
                    : "border-[var(--voxly-line-strong)]"
                }`}
              >
                <span className="absolute inset-0 bg-[linear-gradient(135deg,#202020,#5d5a53_54%,#dad4c7)]" />
                <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white">
                  Frame {frame}
                </span>
              </button>
            ))}
          </div>

          {thumbnailPreview && (
            <div
              className="mt-4 aspect-video rounded-xl border border-[var(--voxly-line-strong)] bg-cover bg-center"
              style={{ backgroundImage: `url(${thumbnailPreview})` }}
              aria-label="Custom thumbnail preview"
              role="img"
            />
          )}
        </section>

        <section className="rounded-2xl border border-[var(--voxly-line)] bg-[var(--voxly-panel)] p-5 shadow-sm sm:p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--voxly-muted)]">
                Visibility
              </p>
              <div className="mt-3 grid gap-2">
                {VISIBILITY_OPTIONS.map((option) => (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      form.visibility === option
                        ? "border-[var(--voxly-accent)] bg-[var(--voxly-accent-soft)] text-[var(--voxly-accent)]"
                        : "border-[var(--voxly-line-strong)] bg-[var(--voxly-panel)] text-[var(--voxly-muted)] hover:bg-[var(--voxly-canvas)]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {option}
                    </span>
                    <input
                      type="radio"
                      name="visibility"
                      value={option}
                      checked={form.visibility === option}
                      onChange={(event) => updateForm("visibility", event.target.value)}
                      className="sr-only"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--voxly-muted)]">
                Release
              </p>
              <div className="mt-3 grid gap-2">
                <label
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    form.releaseMode === "now"
                      ? "border-[var(--voxly-accent)] bg-[var(--voxly-accent-soft)] text-[var(--voxly-accent)]"
                      : "border-[var(--voxly-line-strong)] bg-[var(--voxly-panel)] text-[var(--voxly-muted)] hover:bg-[var(--voxly-canvas)]"
                  }`}
                >
                  Publish now
                  <input
                    type="radio"
                    name="releaseMode"
                    value="now"
                    checked={form.releaseMode === "now"}
                    onChange={(event) => updateForm("releaseMode", event.target.value)}
                    className="sr-only"
                  />
                </label>
                <label
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    form.releaseMode === "schedule"
                      ? "border-[var(--voxly-accent)] bg-[var(--voxly-accent-soft)] text-[var(--voxly-accent)]"
                      : "border-[var(--voxly-line-strong)] bg-[var(--voxly-panel)] text-[var(--voxly-muted)] hover:bg-[var(--voxly-canvas)]"
                  }`}
                >
                  Schedule release
                  <input
                    type="radio"
                    name="releaseMode"
                    value="schedule"
                    checked={form.releaseMode === "schedule"}
                    onChange={(event) => updateForm("releaseMode", event.target.value)}
                    className="sr-only"
                  />
                </label>
                <div className="relative">
                  <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--voxly-muted)]" />
                  <input
                    type="datetime-local"
                    disabled={form.releaseMode !== "schedule"}
                    className="voxly-input w-full py-2.5 pl-9 pr-3 disabled:opacity-50"
                    value={form.scheduledAt}
                    onChange={(event) => updateForm("scheduledAt", event.target.value)}
                  />
                </div>
                {form.releaseMode === "schedule" && (
                  <PublishTimeSuggestion
                    platforms={selected}
                    onApplyTime={(value) => updateForm("scheduledAt", value)}
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <section className="rounded-2xl border border-[var(--voxly-line)] bg-[var(--voxly-panel)] p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--voxly-ink)]">Source preview</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--voxly-success)]/40 bg-[var(--voxly-success-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--voxly-success)]">
              <Check className="h-3 w-3" />
              Uploaded
            </span>
          </div>
          {project.cloudExportUrl ? (
            <video
              src={project.cloudExportUrl}
              controls
              preload="metadata"
              className="aspect-[9/16] w-full rounded-xl bg-black"
              aria-label={`${project.title} preview`}
            />
          ) : (
            <p className="rounded-xl border border-[var(--voxly-warning)]/40 bg-[var(--voxly-warning-soft)] px-3 py-2 text-sm text-[var(--voxly-warning)]">
              This project has no public video URL yet.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--voxly-line)] bg-[var(--voxly-panel)] p-4 shadow-sm">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--voxly-muted)]">
              Destinations
            </p>
            <h2 className="mt-2 text-sm font-semibold text-[var(--voxly-ink)]">
              Connected publishing accounts
            </h2>
          </div>

          <div className="space-y-2">
            {PLATFORMS.map(({ key, label, Icon, accent }) => {
              const isConnected = connectedPlatforms.includes(key);
              const isOn = selected.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!isConnected}
                  onClick={() => togglePlatform(key)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    isOn
                      ? "border-[var(--voxly-accent)] bg-[var(--voxly-accent-soft)] text-[var(--voxly-accent)]"
                      : "border-[var(--voxly-line-strong)] bg-[var(--voxly-panel)] text-[var(--voxly-muted)] hover:bg-[var(--voxly-canvas)]"
                  } ${!isConnected ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${accent}`} />
                    {label}
                  </span>
                  {!isConnected ? <Lock className="h-3.5 w-3.5" /> : isOn ? "On" : "Off"}
                </button>
              );
            })}
          </div>

          {connectedPlatforms.length === 0 && (
            <p className="mt-3 rounded-xl border border-[var(--voxly-warning)]/40 bg-[var(--voxly-warning-soft)] px-3 py-2 text-sm text-[var(--voxly-warning)]">
              No accounts connected.{" "}
              <Link href="/accounts" className="font-semibold underline">
                Connect one
              </Link>
              .
            </p>
          )}
        </section>

        {result && (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${getResultClasses(result.type)}`}>
            {result.msg}
          </div>
        )}

        <button
          className="voxly-btn-primary h-11 w-full shadow-sm disabled:cursor-not-allowed"
          disabled={busy}
          onClick={submit}
        >
          {busy ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {form.releaseMode === "schedule" ? "Schedule publication" : "Publish now"}
        </button>
      </aside>
    </div>
  );
}
