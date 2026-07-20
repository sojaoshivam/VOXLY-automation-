import { db } from "@/db";
import { videoProjects } from "@/db/schema";
import { desc, count, eq } from "drizzle-orm";
import { Video, Cloud, Mic, Clapperboard } from "lucide-react";
import Link from "next/link";
import { DbSetupError } from "@/components/DbSetupError";
import { isMovieRecapProject } from "@/lib/recap-types";

export const dynamic = "force-dynamic";

function getDbErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export default async function HomePage() {
  try {
    const [total] = await db.select({ value: count() }).from(videoProjects);
    const [onCloud] = await db
      .select({ value: count() })
      .from(videoProjects)
      .where(eq(videoProjects.status, "uploaded"));
    const [podcastCount] = await db
      .select({ value: count() })
      .from(videoProjects)
      .where(eq(videoProjects.projectType, "podcast"));
    const [movieCount] = await db
      .select({ value: count() })
      .from(videoProjects)
      .where(eq(videoProjects.projectType, "movie_recap"));

    const recent = await db
      .select()
      .from(videoProjects)
      .orderBy(desc(videoProjects.createdAt))
      .limit(5);

    return (
      <div className="p-8 max-w-3xl mx-auto space-y-8">
        <div className="border-b border-zinc-800 pb-6">
          <h2 className="text-2xl font-bold text-white">Local engine</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Two pipelines — podcast talking-head shorts and AI movie recap shorts.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/studio"
            className="group rounded-2xl border border-violet-900/40 bg-violet-950/20 p-5 hover:border-violet-500/40 transition-colors"
          >
            <div className="h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center mb-4">
              <Mic className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-violet-200">
              Podcast Clips
            </h3>
            <p className="text-sm text-zinc-500 mt-1">
              Talking-head ingest → transcribe → podcast render → R2.
            </p>
            <p className="text-xs font-bold text-violet-400 mt-4">Open Studio →</p>
          </Link>

          <Link
            href="/movie-studio"
            className="group rounded-2xl border border-amber-900/40 bg-amber-950/20 p-5 hover:border-amber-500/40 transition-colors"
          >
            <div className="h-10 w-10 rounded-xl bg-amber-600 flex items-center justify-center mb-4">
              <Clapperboard className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-amber-200">
              Movie Clips
            </h3>
            <p className="text-sm text-zinc-500 mt-1">
              Scene clip → AI script → Sarvam voice → recap render → R2.
            </p>
            <p className="text-xs font-bold text-amber-400 mt-4">Open Movie Studio →</p>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/50">
            <Video className="h-5 w-5 text-violet-400 mb-2" />
            <p className="text-2xl font-bold text-white">{total?.value ?? 0}</p>
            <p className="text-xs text-zinc-500">Total projects</p>
          </div>
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/50">
            <Mic className="h-5 w-5 text-violet-400 mb-2" />
            <p className="text-2xl font-bold text-white">{podcastCount?.value ?? 0}</p>
            <p className="text-xs text-zinc-500">Podcast</p>
          </div>
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/50">
            <Clapperboard className="h-5 w-5 text-amber-400 mb-2" />
            <p className="text-2xl font-bold text-white">{movieCount?.value ?? 0}</p>
            <p className="text-xs text-zinc-500">Movie</p>
          </div>
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/50">
            <Cloud className="h-5 w-5 text-emerald-400 mb-2" />
            <p className="text-2xl font-bold text-white">{onCloud?.value ?? 0}</p>
            <p className="text-xs text-zinc-500">On R2 cloud</p>
          </div>
        </div>

        {recent.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-zinc-400">Recent</h3>
            {recent.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="block p-3 rounded-lg border border-zinc-800 hover:border-violet-500/30 text-sm"
              >
                <span className="text-white font-medium">{p.title}</span>
                <span
                  className={`ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    isMovieRecapProject(p.projectType)
                      ? "bg-amber-950/60 text-amber-300"
                      : "bg-violet-950/60 text-violet-300"
                  }`}
                >
                  {isMovieRecapProject(p.projectType) ? "Movie" : "Podcast"}
                </span>
                <span className="text-zinc-500 ml-2">· {p.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  } catch (error) {
    return <DbSetupError message={getDbErrorMessage(error)} />;
  }
}
