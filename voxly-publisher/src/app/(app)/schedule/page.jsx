import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { scheduledPosts, videoProjects } from "@/db/schema";
import ScheduleList from "@/components/ScheduleList";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const posts = await db
    .select({
      id: scheduledPosts.id,
      projectTitle: videoProjects.title,
      platform: scheduledPosts.platform,
      caption: scheduledPosts.caption,
      status: scheduledPosts.status,
      scheduledAt: scheduledPosts.scheduledAt,
      postedAt: scheduledPosts.postedAt,
      platformPostId: scheduledPosts.platformPostId,
      errorMessage: scheduledPosts.errorMessage,
      createdAt: scheduledPosts.createdAt,
    })
    .from(scheduledPosts)
    .leftJoin(videoProjects, eq(scheduledPosts.projectId, videoProjects.id))
    .where(eq(scheduledPosts.userId, session.user.id))
    .orderBy(desc(scheduledPosts.createdAt));

  return (
    <div>
      <PageHeader
        eyebrow="Schedule"
        title="Schedule and history"
        description="Upcoming scheduled posts and publishing history."
      />
      <ScheduleList initialPosts={posts} />
    </div>
  );
}
