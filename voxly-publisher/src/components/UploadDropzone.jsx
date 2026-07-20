"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  ImagePlus,
  Pause,
  Play,
  RotateCcw,
  UploadCloud,
} from "lucide-react";

const CATEGORIES = ["Short-form", "Education", "Product", "Announcement"];
const VISIBILITY_OPTIONS = ["Public", "Private", "Unlisted"];
const FRAME_OPTIONS = ["00:02", "00:05", "00:09"];
const CHUNK_SIZE_BYTES = 8 * 1024 * 1024;
const STORAGE_KEY = "voxly-upload-session";

const initialUpload = {
  status: "idle",
  fileName: "",
  fileSize: 0,
  uploadedBytes: 0,
  speedBytes: 0,
  error: "",
};

function formatBytes(bytes) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "calculating";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.ceil(seconds % 60);

  return `${minutes}m ${remainingSeconds}s`;
}

function uploadReducer(state, action) {
  switch (action.type) {
    case "restore":
      return { ...initialUpload, ...action.session, status: "paused" };
    case "start":
      return {
        status: "uploading",
        fileName: action.file.name,
        fileSize: action.file.size,
        uploadedBytes: 0,
        speedBytes: 0,
        error: "",
      };
    case "tick": {
      const uploadedBytes = Math.min(state.fileSize, state.uploadedBytes + action.bytes);
      return {
        ...state,
        status: uploadedBytes >= state.fileSize ? "success" : "uploading",
        uploadedBytes,
        speedBytes: action.speedBytes,
      };
    }
    case "pause":
      return { ...state, status: "paused", speedBytes: 0 };
    case "resume":
      return { ...state, status: "uploading" };
    case "error":
      return { ...state, status: "error", error: action.error, speedBytes: 0 };
    case "reset":
      return initialUpload;
    default:
      return state;
  }
}

export default function UploadDropzone() {
  const fileInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  const [upload, dispatch] = useReducer(uploadReducer, initialUpload);
  const [metadata, setMetadata] = useState({
    title: "",
    description: "",
    category: CATEGORIES[0],
    visibility: VISIBILITY_OPTIONS[0],
    scheduledAt: "",
  });
  const [selectedFrame, setSelectedFrame] = useState(FRAME_OPTIONS[0]);
  const [thumbnailPreview, setThumbnailPreview] = useState("");

  const progress = upload.fileSize
    ? Math.min(100, Math.round((upload.uploadedBytes / upload.fileSize) * 100))
    : 0;
  const eta = upload.speedBytes
    ? formatDuration((upload.fileSize - upload.uploadedBytes) / upload.speedBytes)
    : "calculating";

  const uploadSummary = useMemo(
    () => [
      { label: "Progress", value: `${progress}%` },
      { label: "Chunk", value: `${formatBytes(CHUNK_SIZE_BYTES)} parts` },
      { label: "Speed", value: upload.speedBytes ? `${formatBytes(upload.speedBytes)}/s` : "-" },
      { label: "ETA", value: eta },
    ],
    [eta, progress, upload.speedBytes]
  );

  useEffect(() => {
    const savedSession = window.localStorage.getItem(STORAGE_KEY);
    if (!savedSession) return;

    try {
      const session = JSON.parse(savedSession);
      if (session.fileName && session.fileSize) dispatch({ type: "restore", session });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (upload.status === "idle" || upload.status === "success" || upload.status === "error") {
      if (upload.status === "success") window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fileName: upload.fileName,
        fileSize: upload.fileSize,
        uploadedBytes: upload.uploadedBytes,
      })
    );
  }, [upload]);

  useEffect(() => {
    if (upload.status !== "uploading") return undefined;

    const interval = window.setInterval(() => {
      const bytes = Math.min(
        upload.fileSize - upload.uploadedBytes,
        Math.max(CHUNK_SIZE_BYTES * 0.42, upload.fileSize * 0.035)
      );

      dispatch({ type: "tick", bytes, speedBytes: bytes / 0.8 });
    }, 800);

    return () => window.clearInterval(interval);
  }, [upload.fileSize, upload.status, upload.uploadedBytes]);

  useEffect(() => {
    return () => {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    };
  }, [thumbnailPreview]);

  function updateMetadata(key, value) {
    setMetadata((current) => ({ ...current, [key]: value }));
  }

  function handleFiles(files) {
    const [file] = Array.from(files || []);
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      dispatch({ type: "error", error: "Choose a video file to continue." });
      return;
    }

    dispatch({ type: "start", file });
    if (!metadata.title) {
      updateMetadata("title", file.name.replace(/\.[^/.]+$/, ""));
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  }

  function handleThumbnail(file) {
    if (!file) return;
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailPreview(URL.createObjectURL(file));
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--voxly-line)] bg-[var(--voxly-panel)] shadow-sm">
      <div className="grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="border-b border-[var(--voxly-line)] bg-[var(--voxly-panel-soft)] p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--voxly-muted)]">
                Publishing Workspace
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--voxly-ink)] sm:text-3xl">
                Prepare a video release
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--voxly-muted)]">
                Upload progress stays visible while metadata, thumbnail, visibility, and schedule
                details are configured.
              </p>
            </div>
            <span className="hidden rounded-full border border-[var(--voxly-line-strong)] bg-[var(--voxly-panel)] px-3 py-1 text-xs font-medium text-[var(--voxly-muted)] sm:inline-flex">
              Frontend state
            </span>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            className="voxly-lift rounded-2xl border border-dashed border-[var(--voxly-line)] bg-[var(--voxly-panel)] p-4 shadow-sm focus-within:border-[var(--voxly-accent)]"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={(event) => handleFiles(event.target.files)}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-48 w-full flex-col items-center justify-center rounded-xl bg-[var(--voxly-panel-soft)] px-4 text-center transition-colors hover:bg-[var(--voxly-canvas)] focus:outline-none focus:ring-2 focus:ring-[var(--voxly-accent)] focus:ring-offset-2"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--voxly-line-strong)] bg-[var(--voxly-panel)] shadow-sm">
                <UploadCloud className="h-5 w-5 text-[var(--voxly-accent)]" />
              </span>
              <span className="mt-4 text-sm font-semibold text-[var(--voxly-ink)]">
                Drop a video file or browse
              </span>
              <span className="mt-1 max-w-sm text-xs leading-5 text-[var(--voxly-muted)]">
                Large videos are represented as {formatBytes(CHUNK_SIZE_BYTES)} chunks with pause,
                resume, speed, and ETA state.
              </span>
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--voxly-line)] bg-[var(--voxly-panel)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--voxly-ink)]">
                  {upload.fileName || "No active upload"}
                </p>
                <p className="mt-1 text-xs text-[var(--voxly-muted)]">
                  {upload.fileSize ? `${formatBytes(upload.uploadedBytes)} of ${formatBytes(upload.fileSize)}` : "Upload progress will persist through a refresh."}
                </p>
              </div>
              {upload.status === "success" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--voxly-success)]/40 bg-[var(--voxly-success-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--voxly-success)]">
                  <Check className="h-3.5 w-3.5" />
                  Complete
                </span>
              )}
            </div>

            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--voxly-line)]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full rounded-full bg-[var(--voxly-accent)] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {uploadSummary.map((item) => (
                <div key={item.label} className="rounded-xl bg-[var(--voxly-panel-soft)] px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--voxly-muted)]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--voxly-ink)]">{item.value}</p>
                </div>
              ))}
            </div>

            {upload.status === "error" && (
              <p className="mt-3 rounded-xl border border-[var(--voxly-danger)]/40 bg-[var(--voxly-danger-soft)] px-3 py-2 text-sm text-[var(--voxly-danger)]">
                {upload.error}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {upload.status === "uploading" && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "pause" })}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--voxly-line-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--voxly-muted)] transition-colors hover:bg-[var(--voxly-panel-soft)]"
                >
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </button>
              )}
              {upload.status === "paused" && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "resume" })}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--voxly-primary)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--voxly-primary-hover)]"
                >
                  <Play className="h-3.5 w-3.5" />
                  Resume
                </button>
              )}
              {upload.status !== "idle" && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "reset" })}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--voxly-line-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--voxly-muted)] transition-colors hover:bg-[var(--voxly-panel-soft)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--voxly-muted)]">
                Video title
              </label>
              <input
                className="voxly-input mt-2 w-full"
                value={metadata.title}
                onChange={(event) => updateMetadata("title", event.target.value)}
                placeholder="Name this publication"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--voxly-muted)]">
                Description
              </label>
              <textarea
                className="voxly-input mt-2 min-h-28 w-full resize-y"
                value={metadata.description}
                onChange={(event) => updateMetadata("description", event.target.value)}
                placeholder="Add the exact publishing description."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--voxly-muted)]">
                  Category
                </label>
                <select
                  className="voxly-input mt-2 w-full"
                  value={metadata.category}
                  onChange={(event) => updateMetadata("category", event.target.value)}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--voxly-muted)]">
                  Schedule
                </label>
                <div className="relative mt-2">
                  <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--voxly-muted)]" />
                  <input
                    type="datetime-local"
                    className="voxly-input w-full py-2.5 pl-9 pr-3"
                    value={metadata.scheduledAt}
                    onChange={(event) => updateMetadata("scheduledAt", event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--voxly-muted)]">
                Visibility
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {VISIBILITY_OPTIONS.map((option) => (
                  <label
                    key={option}
                    className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                      metadata.visibility === option
                        ? "border-[var(--voxly-accent)] bg-[var(--voxly-accent-soft)] text-[var(--voxly-accent)]"
                        : "border-[var(--voxly-line-strong)] bg-[var(--voxly-panel)] text-[var(--voxly-muted)] hover:bg-[var(--voxly-panel-soft)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={option}
                      checked={metadata.visibility === option}
                      onChange={(event) => updateMetadata("visibility", event.target.value)}
                      className="sr-only"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--voxly-line)] bg-[var(--voxly-panel-soft)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--voxly-ink)]">Thumbnail</p>
                  <p className="mt-1 text-xs text-[var(--voxly-muted)]">
                    Upload a custom image or select a generated frame.
                  </p>
                </div>
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => handleThumbnail(event.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => thumbnailInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--voxly-line-strong)] bg-[var(--voxly-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--voxly-muted)] transition-colors hover:bg-[var(--voxly-panel-soft)]"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Custom
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {FRAME_OPTIONS.map((frame) => (
                  <button
                    key={frame}
                    type="button"
                    onClick={() => setSelectedFrame(frame)}
                    className={`relative aspect-video overflow-hidden rounded-xl border text-left ${
                      selectedFrame === frame && !thumbnailPreview
                        ? "border-[var(--voxly-accent)] ring-2 ring-[var(--voxly-accent)]/25"
                        : "border-[var(--voxly-line-strong)]"
                    }`}
                  >
                    <span className="absolute inset-0 bg-[linear-gradient(135deg,#202020,#63615c_52%,#d9d5ca)]" />
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {frame}
                    </span>
                  </button>
                ))}
              </div>

              {thumbnailPreview && (
                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--voxly-line-strong)]">
                  <img src={thumbnailPreview} alt="Custom thumbnail preview" className="aspect-video w-full object-cover" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
