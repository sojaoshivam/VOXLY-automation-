import { NextResponse } from "next/server";
import { db } from "@/db";
import { videoProjects } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const [project] = await db
      .select()
      .from(videoProjects)
      .where(eq(videoProjects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const completed = !!project.cloudExportUrl || !!project.finalExportPath;

    return NextResponse.json({
      success: true,
      completed,
      exportPath: project.finalExportPath,
      cloudExportUrl: project.cloudExportUrl,
      status: project.status,
    });
  } catch (error: unknown) {
    console.error("Failed to query movie render status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
