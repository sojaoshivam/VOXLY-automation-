import { NextResponse } from "next/server";
import { and, eq, isNotNull, desc } from "drizzle-orm";
import { db } from "@/db";
import { videoProjects } from "@/db/schema";
import { requireUserId } from "@/lib/session";

/** Videos finished by voxly-v2-local and ready to publish. */
export async function GET() {
  try {
    await requireUserId();
    const projects = await db
      .select({
        id: videoProjects.id,
        title: videoProjects.title,
        cloudExportUrl: videoProjects.cloudExportUrl,
        backgroundOption: videoProjects.backgroundOption,
        createdAt: videoProjects.createdAt,
      })
      .from(videoProjects)
      .where(
        and(
          eq(videoProjects.status, "uploaded"),
          isNotNull(videoProjects.cloudExportUrl)
        )
      )
      .orderBy(desc(videoProjects.createdAt));
    return NextResponse.json({ projects });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
