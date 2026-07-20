"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock3, FileVideo, Search, SlidersHorizontal } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "ready", label: "Ready" },
  { value: "processing", label: "Processing" },
  { value: "scheduled", label: "Scheduled" },
  { value: "live", label: "Live" },
  { value: "failed", label: "Failed" },
];

function formatProjectDate(value) {
  if (!value) return "No date";

  const timestamp = Number(value);
  const date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPostDate(post) {
  const value = post.postedAt || post.scheduledAt || post.createdAt;
  if (!value) return "No activity";

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getAssetStatus(project, relatedPosts) {
  const statuses = relatedPosts.map((post) => post.status);

  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("publishing")) return "processing";
  if (statuses.includes("scheduled")) return "scheduled";
  if (statuses.includes("posted")) return "live";
  if (project.status === "uploaded" && project.cloudExportUrl) return "ready";
  if (project.status === "uploading") return "processing";

  return project.status || "draft";
}

function getStatusLabel(status) {
  if (status === "uploaded") return "Ready";
  if (status === "uploading") return "Processing";
  if (status === "posted") return "Live";

  return status;
}

export default function MediaLibrary({ projects, posts }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const assets = useMemo(() => {
    return projects.map((project) => {
      const relatedPosts = posts.filter((post) => post.projectId === project.id);
      const latestPost = relatedPosts[0];
      const status = getAssetStatus(project, relatedPosts);

      return {
        ...project,
        relatedPosts,
        latestPost,
        status,
        statusLabel: getStatusLabel(status),
      };
    });
  }, [posts, projects]);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesQuery =
        !normalizedQuery ||
        asset.title?.toLowerCase().includes(normalizedQuery) ||
        asset.latestPost?.caption?.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === "all" || asset.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [assets, query, statusFilter]);

  const counts = useMemo(
    () => ({
      total: assets.length,
      processing: assets.filter((asset) => asset.status === "processing").length,
      scheduled: assets.filter((asset) => asset.status === "scheduled").length,
      live: assets.filter((asset) => asset.status === "live").length,
      failed: assets.filter((asset) => asset.status === "failed").length,
    }),
    [assets]
  );

  return (
    <section className="rounded-2xl border border-[var(--voxly-line)] bg-[var(--voxly-panel)] shadow-sm">
      <div className="border-b border-[var(--voxly-line)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--voxly-muted)]">
              Media Library
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--voxly-ink)]">
              Manage video publications
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--voxly-muted)]">
              A dense view of processing, scheduled, live, and failed video assets.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[34rem]">
            <div className="rounded-xl border border-[var(--voxly-line)] bg-[var(--voxly-panel-soft)] px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--voxly-muted)]">
                Assets
              </p>
              <p className="mt-1 text-lg font-semibold text-[var(--voxly-ink)]">{counts.total}</p>
            </div>
            <div className="rounded-xl border border-[var(--voxly-line)] bg-[var(--voxly-panel-soft)] px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--voxly-muted)]">
                Processing
              </p>
              <p className="mt-1 text-lg font-semibold text-[var(--voxly-ink)]">{counts.processing}</p>
            </div>
            <div className="rounded-xl border border-[var(--voxly-line)] bg-[var(--voxly-panel-soft)] px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--voxly-muted)]">
                Scheduled
              </p>
              <p className="mt-1 text-lg font-semibold text-[var(--voxly-ink)]">{counts.scheduled}</p>
            </div>
            <div className="rounded-xl border border-[var(--voxly-line)] bg-[var(--voxly-panel-soft)] px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--voxly-muted)]">
                Live
              </p>
              <p className="mt-1 text-lg font-semibold text-[var(--voxly-ink)]">{counts.live}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--voxly-muted)]" />
            <span className="sr-only">Search videos</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title or caption"
              className="voxly-input w-full py-2.5 pl-9 pr-3"
            />
          </label>

          <label className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--voxly-muted)]" />
            <span className="sr-only">Filter by status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="voxly-input w-full py-2.5 pl-9 pr-3"
            >
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filteredAssets.length === 0 ? (
        <div className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-[var(--voxly-line)] bg-[var(--voxly-panel-soft)]">
            <FileVideo className="h-5 w-5 text-[var(--voxly-muted)]" />
          </div>
          <p className="mt-4 text-sm font-semibold text-[var(--voxly-ink)]">No videos match this view</p>
          <p className="mt-1 text-sm text-[var(--voxly-muted)]">
            Clear search or switch the status filter to see more assets.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--voxly-line)]">
          {filteredAssets.map((asset) => (
            <article
              key={asset.id}
              className="grid gap-4 p-4 transition-colors hover:bg-[var(--voxly-panel-soft)] md:grid-cols-[5.5rem_minmax(0,1fr)_10rem_10rem_8rem]"
            >
              <div className="relative aspect-video overflow-hidden rounded-xl border border-[var(--voxly-line-strong)] bg-[#1f1f1f] md:aspect-[4/3]">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,#202020,#4c4a45_58%,#d7d1c2)]" />
                <FileVideo className="absolute left-3 top-3 h-4 w-4 text-white/80" />
              </div>

              <div className="min-w-0 self-center">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-[var(--voxly-ink)]">{asset.title}</h3>
                  <StatusBadge status={asset.status} />
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-[var(--voxly-muted)]">
                  {asset.latestPost?.caption || "No caption published yet."}
                </p>
                {asset.latestPost?.errorMessage && (
                  <p className="mt-1 line-clamp-1 text-xs font-medium text-[var(--voxly-danger)]">
                    {asset.latestPost.errorMessage}
                  </p>
                )}
              </div>

              <div className="self-center text-xs text-[var(--voxly-muted)]">
                <p className="font-medium uppercase tracking-[0.12em] text-[var(--voxly-muted)]">Created</p>
                <p className="mt-1 font-semibold text-[var(--voxly-muted)]">
                  {formatProjectDate(asset.createdAt)}
                </p>
              </div>

              <div className="self-center text-xs text-[var(--voxly-muted)]">
                <p className="inline-flex items-center gap-1 font-medium uppercase tracking-[0.12em] text-[var(--voxly-muted)]">
                  <Clock3 className="h-3 w-3" />
                  Activity
                </p>
                <p className="mt-1 font-semibold text-[var(--voxly-muted)]">
                  {asset.latestPost ? formatPostDate(asset.latestPost) : "Not published"}
                </p>
              </div>

              <div className="flex items-center justify-start gap-2 self-center md:justify-end">
                {asset.cloudExportUrl && (
                  <a
                    href={asset.cloudExportUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--voxly-line-strong)] px-3 text-xs font-semibold text-[var(--voxly-muted)] transition-colors hover:bg-[var(--voxly-canvas)]"
                  >
                    Preview
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                )}
                {asset.cloudExportUrl ? (
                  <Link
                    href={`/publish/${asset.id}`}
                    className="inline-flex h-8 items-center rounded-full bg-[var(--voxly-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--voxly-primary-hover)]"
                  >
                    Configure
                  </Link>
                ) : (
                  <span className="inline-flex h-8 items-center rounded-full border border-[var(--voxly-line)] px-3 text-xs font-semibold text-[var(--voxly-muted)]">
                    Waiting
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
