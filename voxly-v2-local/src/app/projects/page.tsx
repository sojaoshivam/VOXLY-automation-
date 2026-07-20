import { db } from "@/db";
import { videoProjects } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { CheckCircle2, Film, Clapperboard } from "lucide-react";
import { isMovieRecapProject } from "@/lib/recap-types";

export const dynamic = "force-dynamic";

type ProjectsPageProps = {
  searchParams: Promise<{ type?: string }>;
};

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const { type } = await searchParams;
  const filter = type === "podcast" || type === "movie" ? type : "all";

  let projects = await db
    .select()
    .from(videoProjects)
    .orderBy(desc(videoProjects.createdAt));

  if (filter === "podcast") {
    projects = projects.filter(
      (p) => !p.projectType || p.projectType === "podcast"
    );
  } else if (filter === "movie") {
    projects = projects.filter((p) => isMovieRecapProject(p.projectType));
  }

  const tabs = [
    { id: "all", label: "All", href: "/projects" },
    { id: "podcast", label: "Podcast", href: "/projects?type=podcast" },
    { id: "movie", label: "Movie", href: "/projects?type=movie" },
  ] as const;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="border-b border-zinc-800 pb-6 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">Projects</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Podcast and movie recap projects share one library; each uses its own editor and render engine.
          </p>
        </div>
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                filter === tab.id
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No projects yet.{" "}
          {filter === "movie" ? (
            <Link href="/movie-studio" className="text-amber-400 hover:underline">
              Ingest a movie clip
            </Link>
          ) : (
            <Link href="/studio" className="text-violet-400 hover:underline">
              Ingest a podcast clip
            </Link>
          )}
        </p>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => {
            const isMovie = isMovieRecapProject(p.projectType);
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-950/40"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white truncate">{p.title}</p>
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        isMovie
                          ? "bg-amber-950/60 text-amber-300"
                          : "bg-violet-950/60 text-violet-300"
                      }`}
                    >
                      {isMovie ? "Movie" : "Podcast"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {p.status}
                    {p.cloudExportUrl && (
                      <span className="ml-2 text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> on R2
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/projects/${p.id}`}
                    className={`text-xs font-bold text-white px-3 py-2 rounded-lg ${
                      isMovie
                        ? "bg-amber-600 hover:bg-amber-500"
                        : "bg-violet-600 hover:bg-violet-500"
                    }`}
                  >
                    {isMovie ? (
                      <Clapperboard className="h-3.5 w-3.5 inline mr-1" />
                    ) : (
                      <Film className="h-3.5 w-3.5 inline mr-1" />
                    )}
                    Edit
                  </Link>
                  <DeleteProjectButton projectId={p.id} projectTitle={p.title} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
