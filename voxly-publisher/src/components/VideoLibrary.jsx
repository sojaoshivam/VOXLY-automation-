"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Grid3X3,
  List,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import PlatformChips from "@/components/PlatformChips";
import StatusBadge from "@/components/StatusBadge";
import {
  getCoverageSummary,
  getPlatformLabel,
  getPlatformViewUrl,
  getPublishCoverage,
} from "@/lib/publish-coverage";

const STATUS_FILTERS = [
  { value: "needs_publishing", label: "Needs publishing" },
  { value: "partial", label: "Partially published" },
  { value: "published_all", label: "Published everywhere" },
  { value: "all", label: "All statuses" },
  { value: "processing", label: "Processing" },
  { value: "scheduled", label: "Scheduled" },
  { value: "failed", label: "Failed" },
];

function formatProjectDate(value) {
  if (!value) return "No date";
  const timestamp = Number(value);
  const date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
  // Use a fixed locale and timezone to ensure server and client render identically
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function matchesFilter(asset, statusFilter) {
  if (statusFilter === "all") return true;
  if (statusFilter === "needs_publishing") return asset.coverage.needsPublishing;
  if (statusFilter === "published_all") return asset.coverage.isFullyPublished;
  if (statusFilter === "partial") return asset.coverage.coverage === "partial";
  return asset.status === statusFilter;
}

function VideoActions({ asset }) {
  const { coverage, platformStatus } = asset;
  const isFullyPublished = coverage.isFullyPublished;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {asset.cloudExportUrl && !isFullyPublished && (
        <Link
          href={`/publish/${asset.id}`}
          className="rounded-lg bg-[var(--voxly-ink)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2a2927]"
        >
          Publish
        </Link>
      )}
      {coverage.postedPlatforms.map((platform) => {
        const info = platformStatus[platform];
        const url = getPlatformViewUrl(platform, info?.platformPostId);
        if (!url || platform !== "youtube") return null;
        return (
          <a
            key={platform}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-[#b8dccb] bg-[#eefaf4] px-3 py-1.5 text-xs font-semibold text-[#0f6f49] hover:bg-[#e0f5ea]"
          >
            View on {getPlatformLabel(platform)}
            <ArrowUpRight className="h-3 w-3" />
          </a>
        );
      })}
      {asset.cloudExportUrl && (
        <a
          href={asset.cloudExportUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--voxly-line)] px-3 py-1.5 text-xs font-semibold text-[var(--voxly-muted)] hover:bg-[var(--voxly-canvas)]"
        >
          Preview
          <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
      <button
        type="button"
        onClick={() => asset.onDelete?.()}
        className="inline-flex items-center gap-1 rounded-lg border border-[#f4c7c3] px-3 py-1.5 text-xs font-semibold text-[var(--voxly-danger)] hover:bg-[#fff0ed]"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>
    </div>
  );
}

export default function VideoLibrary({ projects, posts, connectedPlatforms }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("needs_publishing");
  const [viewMode, setViewMode] = useState("grid");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const assets = useMemo(() => {
    return projects.map((project) => {
      const relatedPosts = posts.filter((post) => post.projectId === project.id);
      const coverage = getPublishCoverage({
        project,
        connectedPlatforms,
        postsForProject: relatedPosts,
      });
      return {
        ...project,
        relatedPosts,
        coverage,
        platformStatus: coverage.platformStatus,
        status: coverage.displayStatus,
      };
    });
  }, [posts, projects, connectedPlatforms]);

  const summary = useMemo(() => getCoverageSummary(assets), [assets]);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesQuery = !normalizedQuery || asset.title?.toLowerCase().includes(normalizedQuery);
      const matchesStatus = matchesFilter(asset, statusFilter);
      return matchesQuery && matchesStatus;
    });
  }, [assets, query, statusFilter]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects?id=${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-2xl border border-[#f4c7c3] bg-[#fff0ed] px-4 py-3 text-sm text-[var(--voxly-danger)]">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-[var(--voxly-line)] bg-[var(--voxly-canvas)] px-4 py-3 text-sm text-[var(--voxly-muted)]">
        <span className="font-semibold text-[var(--voxly-ink)]">{summary.needsPublishing}</span>{" "}
        {summary.needsPublishing === 1 ? "video needs" : "videos need"} publishing
        <span className="mx-2 text-[var(--voxly-line-strong)]">·</span>
        <span className="font-semibold text-[var(--voxly-ink)]">{summary.publishedAll}</span>{" "}
        published everywhere
        {summary.partial > 0 && (
          <>
            <span className="mx-2 text-[var(--voxly-line-strong)]">·</span>
            <span className="font-semibold text-[var(--voxly-ink)]">{summary.partial}</span> partial
          </>
        )}
      </div>

      <div className="voxly-card rounded-2xl border border-[var(--voxly-line)] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--voxly-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title"
                className="voxly-input w-full py-2.5 pl-9 pr-3"
              />
            </label>
            <label className="relative">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--voxly-muted)]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="voxly-input w-full py-2.5 pl-9 pr-3"
              >
                {STATUS_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-[var(--voxly-line)] bg-[var(--voxly-canvas)] p-1">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded-lg p-2 ${viewMode === "grid" ? "bg-white shadow-sm" : ""}`}
              aria-label="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-lg p-2 ${viewMode === "list" ? "bg-white shadow-sm" : ""}`}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {filteredAssets.length === 0 ? (
        <div className="voxly-card rounded-2xl border border-dashed border-[var(--voxly-line-strong)] bg-white p-12 text-center">
          <p className="text-sm font-semibold text-[var(--voxly-ink)]">No videos match this view</p>
          <p className="mt-1 text-sm text-[var(--voxly-muted)]">
            {statusFilter === "needs_publishing"
              ? "All caught up — create new videos in voxly-v2-local."
              : "Try adjusting your search or filters."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => (
            <article
              key={asset.id}
              className={`voxly-card voxly-lift relative overflow-hidden rounded-2xl border border-[var(--voxly-line)] bg-white shadow-sm ${
                asset.coverage.isFullyPublished ? "opacity-75" : ""
              }`}
            >
              {asset.coverage.isFullyPublished && (
                <span className="absolute right-3 top-3 z-10 rounded-full bg-[#0a5c38] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  Published
                </span>
              )}
              <div className="relative aspect-video bg-[#1a1a1a]">
                {asset.cloudExportUrl ? (
                  <video
                    src={asset.cloudExportUrl}
                    preload="metadata"
                    muted
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-white/60">
                    Processing…
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-sm font-semibold text-[var(--voxly-ink)]">{asset.title}</h3>
                  <StatusBadge status={asset.status} />
                </div>
                <p className="mt-1 text-xs text-[var(--voxly-muted)]">{formatProjectDate(asset.createdAt)}</p>
                <div className="mt-2">
                  <PlatformChips
                    connectedPlatforms={connectedPlatforms}
                    platformStatus={asset.platformStatus}
                  />
                </div>
                <VideoActions asset={{ ...asset, onDelete: () => setDeleteTarget(asset) }} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="voxly-card divide-y divide-[var(--voxly-line)] overflow-hidden rounded-2xl border border-[var(--voxly-line)] bg-white shadow-sm">
          {filteredAssets.map((asset) => (
            <article
              key={asset.id}
              className={`flex flex-col gap-4 p-4 sm:flex-row sm:items-center ${
                asset.coverage.isFullyPublished ? "opacity-75" : ""
              }`}
            >
              <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-[#1a1a1a]">
                {asset.cloudExportUrl && (
                  <video src={asset.cloudExportUrl} preload="metadata" muted className="h-full w-full object-cover" />
                )}
                {asset.coverage.isFullyPublished && (
                  <span className="absolute bottom-1 left-1 rounded bg-[#0a5c38] px-1.5 py-0.5 text-[9px] font-bold text-white">
                    Done
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-[var(--voxly-ink)]">{asset.title}</h3>
                  <StatusBadge status={asset.status} />
                </div>
                <p className="text-xs text-[var(--voxly-muted)]">{formatProjectDate(asset.createdAt)}</p>
                <div className="mt-2">
                  <PlatformChips
                    connectedPlatforms={connectedPlatforms}
                    platformStatus={asset.platformStatus}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {asset.cloudExportUrl && !asset.coverage.isFullyPublished && (
                  <Link
                    href={`/publish/${asset.id}`}
                    className="rounded-lg bg-[var(--voxly-ink)] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Publish
                  </Link>
                )}
                {asset.coverage.postedPlatforms.map((platform) => {
                  const info = asset.platformStatus[platform];
                  const url = getPlatformViewUrl(platform, info?.platformPostId);
                  if (!url || platform !== "youtube") return null;
                  return (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-[#b8dccb] px-3 py-1.5 text-xs font-semibold text-[#0f6f49]"
                    >
                      View on {getPlatformLabel(platform)}
                    </a>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setDeleteTarget(asset)}
                  className="rounded-lg border border-[#f4c7c3] px-3 py-1.5 text-xs font-semibold text-[var(--voxly-danger)]"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete video?"
        message={`"${deleteTarget?.title}" will be permanently removed from the cloud library and all related publishing records. This cannot be undone.`}
        confirmLabel="Delete video"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
