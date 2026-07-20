import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { videoProjects, scheduledPosts, socialAccounts } from "@/db/schema";
import PageHeader from "@/components/PageHeader";
import VideoLibrary from "@/components/VideoLibrary";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [projects, posts, accounts] = await Promise.all([
    db
      .select({
        id: videoProjects.id,
        title: videoProjects.title,
        cloudExportUrl: videoProjects.cloudExportUrl,
        status: videoProjects.status,
        createdAt: videoProjects.createdAt,
      })
      .from(videoProjects)
      .orderBy(desc(videoProjects.createdAt)),
    db
      .select({
        id: scheduledPosts.id,
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

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Video library"
        description="All videos stored in the cloud. Published videos are marked so you can see what still needs to go out."
      />
      <VideoLibrary
        projects={projects}
        posts={posts}
        connectedPlatforms={connectedPlatforms}
      />
    </div>
  );
}
