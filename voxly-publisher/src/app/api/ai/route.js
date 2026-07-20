import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { videoProjects, userSettings } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { generateMetadata, improveCaption, generateTagsFromKeywords } from "@/lib/ai";
import { upsertProjectMetadata } from "@/lib/project-metadata";

async function getAiModel(userId) {
  const [settings] = await db
    .select({ aiModel: userSettings.aiModel })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return settings?.aiModel || "openai/gpt-4o-mini";
}

export async function POST(request) {
  let userId;
  try {
    userId = await requireUserId();
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const body = await request.json();
  const { action, projectId, caption, keywords } = body;

  try {
    const model = await getAiModel(userId);

    if (action === "generate-metadata") {
      if (!projectId) {
        return NextResponse.json({ error: "projectId is required" }, { status: 400 });
      }

      const [project] = await db
        .select({ transcriptData: videoProjects.transcriptData, title: videoProjects.title })
        .from(videoProjects)
        .where(eq(videoProjects.id, projectId))
        .limit(1);

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const result = await generateMetadata({
        transcriptData: project.transcriptData,
        model,
      });

      await upsertProjectMetadata({
        projectId,
        userId,
        title: result.title || project.title,
        caption: result.caption,
        hashtags: result.hashtags,
        aiGenerated: true,
      });

      return NextResponse.json(result);
    }

    if (action === "improve-caption") {
      const result = await improveCaption({ caption, model });

      if (projectId) {
        await upsertProjectMetadata({
          projectId,
          userId,
          caption: result.caption,
          hashtags: result.hashtags,
          aiGenerated: true,
        });
      }

      return NextResponse.json(result);
    }

    if (action === "generate-tags") {
      const result = await generateTagsFromKeywords({ keywords, model });

      if (projectId) {
        await upsertProjectMetadata({
          projectId,
          userId,
          hashtags: result.hashtags,
          seedKeywords: keywords,
          aiGenerated: true,
        });
      }

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
