import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { videoProjects, scheduledPosts, projectMetadata } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { deleteCloudVideo } from "@/lib/r2";

export async function GET() {
  try {
    await requireUserId();
    const projects = await db
      .select({
        id: videoProjects.id,
        title: videoProjects.title,
        cloudExportUrl: videoProjects.cloudExportUrl,
        status: videoProjects.status,
        transcriptData: videoProjects.transcriptData,
        createdAt: videoProjects.createdAt,
      })
      .from(videoProjects)
      .orderBy(desc(videoProjects.createdAt));
    return NextResponse.json({ projects });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}

export async function DELETE(request) {
  try {
    await requireUserId();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const [project] = await db
      .select()
      .from(videoProjects)
      .where(eq(videoProjects.id, id))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const cloudResult = await deleteCloudVideo({
      projectId: project.id,
      cloudExportUrl: project.cloudExportUrl,
    });

    await db.delete(scheduledPosts).where(eq(scheduledPosts.projectId, id));
    await db.delete(projectMetadata).where(eq(projectMetadata.projectId, id));
    await db.delete(videoProjects).where(eq(videoProjects.id, id));

    return NextResponse.json({
      ok: true,
      cloud: cloudResult,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
