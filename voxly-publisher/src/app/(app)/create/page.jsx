import { redirect } from "next/navigation";
import Link from "next/link";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { ArrowRight, CloudUpload, PenSquare } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { videoProjects, scheduledPosts, socialAccounts } from "@/db/schema";
import PageHeader from "@/components/PageHeader";
import { getPublishCoverage } from "@/lib/publish-coverage";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [readyProjects, posts, accounts] = await Promise.all([
    db
      .select({
        id: videoProjects.id,
        title: videoProjects.title,
        cloudExportUrl: videoProjects.cloudExportUrl,
        status: videoProjects.status,
        createdAt: videoProjects.createdAt,
      })
      .from(videoProjects)
      .where(and(eq(videoProjects.status, "uploaded"), isNotNull(videoProjects.cloudExportUrl)))
      .orderBy(desc(videoProjects.createdAt)),
    db
      .select({
        projectId: scheduledPosts.projectId,
        platform: scheduledPosts.platform,
        status: scheduledPosts.status,
        postedAt: scheduledPosts.postedAt,
        platformPostId: scheduledPosts.platformPostId,
        createdAt: scheduledPosts.createdAt,
      })
      .from(scheduledPosts)
      .where(eq(scheduledPosts.userId, session.user.id)),
    db
      .select({ platform: socialAccounts.platform })
      .from(socialAccounts)
      .where(eq(socialAccounts.userId, session.user.id)),
  ]);

  const connectedPlatforms = [...new Set(accounts.map((a) => a.platform))];

  const unpublishedProjects = readyProjects.filter((project) => {
    const projectPosts = posts.filter((p) => p.projectId === project.id);
    const coverage = getPublishCoverage({
      project,
      connectedPlatforms,
      postsForProject: projectPosts,
    });
    return !coverage.isFullyPublished;
  });

  const allPublished =
    readyProjects.length > 0 && unpublishedProjects.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Create / Publish"
        title="Publish a video"
        description="Videos not yet published on all connected channels. Once everything is live, create new videos in voxly-v2-local."
      />

      <section className="voxly-card mb-8 rounded-2xl border border-[var(--voxly-line)] bg-[var(--voxly-accent-soft)] p-6">
        <div className="flex items-start gap-4">
          <CloudUpload className="h-6 w-6 shrink-0 text-[var(--voxly-accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--voxly-ink)]">Upload new videos</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--voxly-muted)]">
              Video processing and cloud upload happen in{" "}
              <strong className="text-[var(--voxly-ink)]">voxly-v2-local</strong>. Once uploaded,
              videos appear here automatically for publishing.
            </p>
          </div>
        </div>
      </section>

      {allPublished ? (
        <div className="voxly-card rounded-2xl border border-[#b8dccb] bg-[#eefaf4] p-12 text-center">
          <PenSquare className="mx-auto h-8 w-8 text-[#0f6f49]" />
          <p className="mt-4 text-sm font-semibold text-[var(--voxly-ink)]">
            All videos published on connected channels
          </p>
          <p className="mt-1 text-sm text-[var(--voxly-muted)]">
            You&apos;re caught up. Create new videos in voxly-v2-local to keep your content pipeline
            going.
          </p>
          <Link
            href="/library"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--voxly-accent)] hover:underline"
          >
            View published library
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : unpublishedProjects.length === 0 ? (
        <div className="voxly-card rounded-2xl border border-dashed border-[var(--voxly-line-strong)] bg-white p-12 text-center">
          <PenSquare className="mx-auto h-8 w-8 text-[var(--voxly-muted)]" />
          <p className="mt-4 text-sm font-semibold text-[var(--voxly-ink)]">No videos ready to publish</p>
          <p className="mt-1 text-sm text-[var(--voxly-muted)]">
            Process and upload a video in voxly-v2-local, then return here to publish.
          </p>
          <Link
            href="/library"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--voxly-accent)] hover:underline"
          >
            Browse full library
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {unpublishedProjects.map((project) => (
            <article
              key={project.id}
              className="voxly-card voxly-lift overflow-hidden rounded-2xl border border-[var(--voxly-line)] bg-white shadow-sm"
            >
              <div className="aspect-video bg-[#1a1a1a]">
                <video
                  src={project.cloudExportUrl}
                  preload="metadata"
                  muted
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="line-clamp-2 text-sm font-semibold text-[var(--voxly-ink)]">
                  {project.title}
                </h3>
                <Link
                  href={`/publish/${project.id}`}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--voxly-ink)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2a2927]"
                >
                  Configure & publish
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
