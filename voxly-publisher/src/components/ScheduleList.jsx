"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Search, SlidersHorizontal, Trash2, Video } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

const STATUS_FILTERS = ["all", "scheduled", "publishing", "posted", "failed"];

function PlatformIcon({ platform }) {
  return platform === "youtube" ? (
    <Video className="h-4 w-4 text-[#d92d20]" />
  ) : (
    <Camera className="h-4 w-4 text-[#c11574]" />
  );
}

function formatDate(post) {
  if (post.postedAt) return `Posted ${new Date(post.postedAt).toLocaleString()}`;
  if (post.scheduledAt) return new Date(post.scheduledAt).toLocaleString();

  return "No date";
}

export default function ScheduleList({ initialPosts }) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState("");

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesQuery =
        !normalizedQuery ||
        post.projectTitle?.toLowerCase().includes(normalizedQuery) ||
        post.caption?.toLowerCase().includes(normalizedQuery) ||
        post.platform?.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === "all" || post.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [posts, query, statusFilter]);

  async function cancel(id) {
    setCancellingId(id);
    setError("");

    try {
      const response = await fetch(`/api/schedule?id=${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not cancel this scheduled post.");

      setPosts((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId("");
    }
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#c9c5bb] bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-[#171717]">No scheduled or posted items yet</p>
        <p className="mt-1 text-sm text-[#66635f]">
          Publications will appear here after they are scheduled or sent.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#dedbd3] bg-white shadow-sm">
      <div className="border-b border-[#ebe8df] p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8379]" />
            <span className="sr-only">Search publications</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search video, caption, or platform"
              className="w-full rounded-xl border border-[#d8d4cb] bg-white py-2.5 pl-9 pr-3 text-sm text-[#171717] outline-none transition-colors placeholder:text-[#aaa49a] focus:border-[#1f5eff] focus:ring-2 focus:ring-[#dfe7ff]"
            />
          </label>

          <label className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8379]" />
            <span className="sr-only">Filter publications by status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-xl border border-[#d8d4cb] bg-white py-2.5 pl-9 pr-3 text-sm font-medium capitalize text-[#171717] outline-none focus:border-[#1f5eff] focus:ring-2 focus:ring-[#dfe7ff]"
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All statuses" : status}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p className="mt-3 rounded-xl border border-[#f4c7c3] bg-[#fff0ed] px-3 py-2 text-sm font-medium text-[#b42318]">
            {error}
          </p>
        )}
      </div>

      {filteredPosts.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-semibold text-[#171717]">No publications match this view</p>
          <p className="mt-1 text-sm text-[#66635f]">
            Clear the search field or choose a different status.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[#ebe8df] bg-[#fbfaf8] text-[11px] uppercase tracking-[0.12em] text-[#766f66]">
              <tr>
                <th className="px-4 py-3 font-semibold">Video</th>
                <th className="px-4 py-3 font-semibold">Platform</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Scheduled / posted</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ebe8df]">
              {filteredPosts.map((post) => (
                <tr key={post.id} className="transition-colors hover:bg-[#fbfaf8]">
                  <td className="max-w-xs px-4 py-3">
                    <p className="truncate font-semibold text-[#171717]">
                      {post.projectTitle || post.caption || "Untitled video"}
                    </p>
                    {post.caption && (
                      <p className="mt-1 truncate text-xs text-[#66635f]">{post.caption}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 capitalize text-[#4f4b45]">
                      <PlatformIcon platform={post.platform} />
                      {post.platform}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={post.status} />
                    {post.status === "failed" && post.errorMessage && (
                      <div className="mt-1 max-w-xs text-xs font-medium text-[#b42318]">
                        {post.errorMessage}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-[#66635f]">
                    {formatDate(post)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {post.status === "scheduled" ? (
                      <button
                        onClick={() => cancel(post.id)}
                        disabled={cancellingId === post.id}
                        className="inline-flex h-8 items-center gap-2 rounded-full border border-[#f4c7c3] px-3 text-xs font-semibold text-[#b42318] transition-colors hover:bg-[#fff0ed] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cancellingId === post.id ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Cancel
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-[#aaa49a]">No action</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
