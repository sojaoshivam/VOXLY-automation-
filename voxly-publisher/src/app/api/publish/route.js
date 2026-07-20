import crypto from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { scheduledPosts } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { publishToPlatform } from "@/lib/publisher";

// Publishing (especially the IG container poll + YouTube upload) can take a while.
export const maxDuration = 300;

export async function POST(request) {
  let userId;
  try {
    userId = await requireUserId();
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const { projectId, platforms, caption, hashtags } = await request.json();

  if (!projectId || !Array.isArray(platforms) || platforms.length === 0) {
    return NextResponse.json(
      { error: "projectId and at least one platform are required" },
      { status: 400 }
    );
  }

  const results = [];

  for (const platform of platforms) {
    const id = crypto.randomUUID();
    await db.insert(scheduledPosts).values({
      id,
      userId,
      projectId,
      platform,
      caption,
      hashtags,
      status: "publishing",
    });

    try {
      const { platformPostId } = await publishToPlatform({
        userId,
        projectId,
        platform,
        caption,
        hashtags,
      });
      await db
        .update(scheduledPosts)
        .set({ status: "posted", postedAt: new Date(), platformPostId })
        .where(eq(scheduledPosts.id, id));
      results.push({ platform, status: "posted", platformPostId });
    } catch (err) {
      await db
        .update(scheduledPosts)
        .set({ status: "failed", errorMessage: err.message })
        .where(eq(scheduledPosts.id, id));
      results.push({ platform, status: "failed", error: err.message });
    }
  }

  return NextResponse.json({ results });
}
