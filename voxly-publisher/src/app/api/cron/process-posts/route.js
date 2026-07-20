import { NextResponse } from "next/server";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { scheduledPosts } from "@/db/schema";
import { publishToPlatform } from "@/lib/publisher";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/** Vercel cron entrypoint: publish any due scheduled posts. */
export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await db
    .select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.status, "scheduled"),
        lte(scheduledPosts.scheduledAt, new Date())
      )
    );

  const results = [];
  for (const post of due) {
    await db
      .update(scheduledPosts)
      .set({ status: "publishing" })
      .where(eq(scheduledPosts.id, post.id));

    try {
      const { platformPostId } = await publishToPlatform({
        userId: post.userId,
        projectId: post.projectId,
        platform: post.platform,
        caption: post.caption,
        hashtags: post.hashtags,
      });
      await db
        .update(scheduledPosts)
        .set({ status: "posted", postedAt: new Date(), platformPostId })
        .where(eq(scheduledPosts.id, post.id));
      results.push({ id: post.id, status: "posted" });
    } catch (err) {
      await db
        .update(scheduledPosts)
        .set({ status: "failed", errorMessage: err.message })
        .where(eq(scheduledPosts.id, post.id));
      results.push({ id: post.id, status: "failed", error: err.message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
