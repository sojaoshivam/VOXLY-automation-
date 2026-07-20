import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, desc, sql, and, isNotNull } from "drizzle-orm";
import { ArrowRight, CalendarClock, FileVideo, Radio, Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { videoProjects, scheduledPosts, socialAccounts } from "@/db/schema";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { getPublishCoverage } from "@/lib/publish-coverage";

export const dynamic = "force-dynamic";

async function getDashboardData(userId) {
  const [projects, allReadyProjects, allPosts, recentPosts, accounts, stats] = await Promise.all([
    db
      .select({
        id: videoProjects.id,
        title: videoProjects.title,
        status: videoProjects.status,
        cloudExportUrl: videoProjects.cloudExportUrl,
        createdAt: videoProjects.createdAt,
      })
      .from(videoProjects)
      .orderBy(desc(videoProjects.createdAt))
      .limit(5),
    db
      .select({
        id: videoProjects.id,
        title: videoProjects.title,
        status: videoProjects.status,
        cloudExportUrl: videoProjects.cloudExportUrl,
      })
      .from(videoProjects)
      .where(
        and(eq(videoProjects.status, "uploaded"), isNotNull(videoProjects.cloudExportUrl))
      ),
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
      .where(eq(scheduledPosts.userId, userId)),
    db
      .select({
        id: scheduledPosts.id,
        projectId: scheduledPosts.projectId,
        platform: scheduledPosts.platform,
        status: scheduledPosts.status,
        scheduledAt: scheduledPosts.scheduledAt,
        postedAt: scheduledPosts.postedAt,
        createdAt: scheduledPosts.createdAt,
      })
      .from(scheduledPosts)
      .where(eq(scheduledPosts.userId, userId))
      .orderBy(desc(scheduledPosts.createdAt))
      .limit(6),
    db
      .select({ platform: socialAccounts.platform })
      .from(socialAccounts)
      .where(eq(socialAccounts.userId, userId)),
    db
      .select({
        total: sql`count(*)::int`,
        live: sql`count(*) filter (where ${scheduledPosts.status} = 'posted')::int`,
        scheduled: sql`count(*) filter (where ${scheduledPosts.status} = 'scheduled')::int`,
        failed: sql`count(*) filter (where ${scheduledPosts.status} = 'failed')::int`,
      })
      .from(scheduledPosts)
      .where(eq(scheduledPosts.userId, userId)),
  ]);

  const connectedPlatforms = [...new Set(accounts.map((a) => a.platform))];

  let actionableCount = 0;
  let publishedAllCount = 0;

  for (const project of allReadyProjects) {
    const projectPosts = allPosts.filter((p) => p.projectId === project.id);
    const coverage = getPublishCoverage({
      project,
      connectedPlatforms,
      postsForProject: projectPosts,
    });
    if (coverage.isFullyPublished) {
      publishedAllCount += 1;
    } else if (coverage.needsPublishing) {
      actionableCount += 1;
    }
  }

  const allCaughtUp =
    allReadyProjects.length > 0 && actionableCount === 0 && connectedPlatforms.length > 0;

  const recentWithCoverage = projects.map((project) => {
    const projectPosts = allPosts.filter((p) => p.projectId === project.id);
    const coverage = getPublishCoverage({
      project,
      connectedPlatforms,
      postsForProject: projectPosts,
    });
    return { ...project, coverage };
  });

  return {
    projects: recentWithCoverage,
    posts: recentPosts,
    stats: stats[0],
    actionableCount,
    publishedAllCount,
    readyCount: allReadyProjects.length,
    allCaughtUp,
    connectedPlatforms,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let data = {
    projects: [],
    posts: [],
    stats: { total: 0, live: 0, scheduled: 0, failed: 0 },
    actionableCount: 0,
    publishedAllCount: 0,
    readyCount: 0,
    allCaughtUp: false,
    connectedPlatforms: [],
  };
  let dbError = null;

  try {
    data = await getDashboardData(session.user.id);
  } catch (err) {
    dbError = err.message;
  }

  const statCards = [
    { label: "Need publishing", value: data.actionableCount, icon: FileVideo },
    { label: "Published everywhere", value: data.publishedAllCount, icon: Sparkles },
    { label: "Live posts", value: data.stats.live, icon: Radio },
    { label: "Scheduled", value: data.stats.scheduled, icon: CalendarClock },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back${session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}`}
        description="Overview of your cloud library, publishing activity, and what still needs to go live."
      />

      {dbError && (
        <div className="mb-6 rounded-2xl border border-[#f4c7c3] bg-[#fff0ed] px-4 py-3 text-sm font-medium text-[var(--voxly-danger)]">
          Could not reach the database: {dbError}
        </div>
      )}

      {data.allCaughtUp && (
        <div className="mb-6 rounded-2xl border border-[#b8dccb] bg-[#eefaf4] px-5 py-4">
          <p className="text-sm font-semibold text-[var(--voxly-ink)]">All caught up</p>
          <p className="mt-1 text-sm text-[var(--voxly-muted)]">
            Every cloud video is published on all connected channels. Create new videos in
            voxly-v2-local to keep growing your reach.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="voxly-card voxly-lift rounded-2xl border border-[var(--voxly-line)] bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--voxly-muted)]">
                {label}
              </p>
              <Icon className="h-4 w-4 text-[var(--voxly-muted)]" />
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[var(--voxly-ink)]">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="voxly-card rounded-2xl border border-[var(--voxly-line)] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--voxly-ink)]">Recent videos</h2>
            <Link href="/library" className="text-sm font-semibold text-[var(--voxly-accent)] hover:underline">
              View library
            </Link>
          </div>
          <div className="mt-4 divide-y divide-[var(--voxly-line)]">
            {data.projects.length === 0 ? (
              <p className="py-6 text-sm text-[var(--voxly-muted)]">No videos in the cloud yet.</p>
            ) : (
              data.projects.map((project) => (
                <div key={project.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--voxly-ink)]">{project.title}</p>
                    <StatusBadge status={project.coverage.displayStatus} />
                  </div>
                  {project.cloudExportUrl && !project.coverage.isFullyPublished && (
                    <Link
                      href={`/publish/${project.id}`}
                      className="shrink-0 rounded-full bg-[var(--voxly-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--voxly-primary-hover)]"
                    >
                      Publish
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="voxly-card rounded-2xl border border-[var(--voxly-line)] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--voxly-ink)]">Publishing activity</h2>
            <Link href="/schedule" className="text-sm font-semibold text-[var(--voxly-accent)] hover:underline">
              Full history
            </Link>
          </div>
          <div className="mt-4 divide-y divide-[var(--voxly-line)]">
            {data.posts.length === 0 ? (
              <p className="py-6 text-sm text-[var(--voxly-muted)]">No publishing activity yet.</p>
            ) : (
              data.posts.map((post) => (
                <div key={post.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold capitalize text-[var(--voxly-ink)]">{post.platform}</p>
                    <p className="text-xs text-[var(--voxly-muted)]">
                      {post.postedAt
                        ? new Date(post.postedAt).toLocaleString()
                        : post.scheduledAt
                          ? `Scheduled ${new Date(post.scheduledAt).toLocaleString()}`
                          : "Draft"}
                    </p>
                  </div>
                  <StatusBadge status={post.status} />
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="mt-8 rounded-2xl border border-[var(--voxly-line)] bg-[var(--voxly-accent-soft)] p-6">
        <h2 className="text-lg font-semibold text-[var(--voxly-ink)]">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/create"
            className="rounded-xl bg-[var(--voxly-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--voxly-primary-hover)]"
          >
            Create & publish
          </Link>
          <Link
            href="/library"
            className="rounded-xl border border-[var(--voxly-line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--voxly-ink)] hover:bg-[var(--voxly-canvas)]"
          >
            Browse library
          </Link>
          <Link
            href="/accounts"
            className="rounded-xl border border-[var(--voxly-line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--voxly-ink)] hover:bg-[var(--voxly-canvas)]"
          >
            Connect accounts
          </Link>
        </div>
      </div>
    </div>
  );
}
