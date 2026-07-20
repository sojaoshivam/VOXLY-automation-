import crypto from "crypto";
import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { scheduledPosts, videoProjects } from "@/db/schema";
import { requireUserId } from "@/lib/session";

/** List the current user's posts (scheduled + history), newest first. */
export async function GET() {
  try {
    const userId = await requireUserId();
    const posts = await db
      .select({
        id: scheduledPosts.id,
        projectId: scheduledPosts.projectId,
        projectTitle: videoProjects.title,
        platform: scheduledPosts.platform,
        caption: scheduledPosts.caption,
        hashtags: scheduledPosts.hashtags,
        status: scheduledPosts.status,
        scheduledAt: scheduledPosts.scheduledAt,
        postedAt: scheduledPosts.postedAt,
        platformPostId: scheduledPosts.platformPostId,
        errorMessage: scheduledPosts.errorMessage,
        createdAt: scheduledPosts.createdAt,
      })
      .from(scheduledPosts)
      .leftJoin(videoProjects, eq(scheduledPosts.projectId, videoProjects.id))
      .where(eq(scheduledPosts.userId, userId))
      .orderBy(desc(scheduledPosts.createdAt));
    return NextResponse.json({ posts });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}

/** Create one scheduled post per selected platform. */
export async function POST(request) {
  try {
    const userId = await requireUserId();
    const { projectId, platforms, caption, hashtags, scheduledAt } =
      await request.json();

    if (!projectId || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: "projectId and at least one platform are required" },
        { status: 400 }
      );
    }
    if (!scheduledAt) {
      return NextResponse.json({ error: "scheduledAt is required" }, { status: 400 });
    }

    const created = [];
    for (const platform of platforms) {
      const id = crypto.randomUUID();
      await db.insert(scheduledPosts).values({
        id,
        userId,
        projectId,
        platform,
        caption,
        hashtags,
        status: "scheduled",
        scheduledAt: new Date(scheduledAt),
      });
      created.push(id);
    }
    return NextResponse.json({ ok: true, created });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}

/** Cancel/delete a scheduled post owned by the user. */
export async function DELETE(request) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await db
      .delete(scheduledPosts)
      .where(and(eq(scheduledPosts.id, id), eq(scheduledPosts.userId, userId)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
