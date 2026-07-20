import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projectMetadata } from "@/db/schema";

export async function getProjectMetadata(projectId, userId) {
  const [row] = await db
    .select()
    .from(projectMetadata)
    .where(eq(projectMetadata.projectId, projectId))
    .limit(1);

  if (!row || row.userId !== userId) return null;
  return row;
}

export async function upsertProjectMetadata({ projectId, userId, title, caption, hashtags, seedKeywords, aiGenerated }) {
  const existing = await getProjectMetadata(projectId, userId);
  const now = new Date();

  if (existing) {
    await db
      .update(projectMetadata)
      .set({
        title: title ?? existing.title,
        caption: caption ?? existing.caption,
        hashtags: hashtags ?? existing.hashtags,
        seedKeywords: seedKeywords ?? existing.seedKeywords,
        aiGeneratedAt: aiGenerated ? now : existing.aiGeneratedAt,
        updatedAt: now,
      })
      .where(eq(projectMetadata.id, existing.id));
    return existing.id;
  }

  const id = crypto.randomUUID();
  await db.insert(projectMetadata).values({
    id,
    projectId,
    userId,
    title,
    caption,
    hashtags,
    seedKeywords,
    aiGeneratedAt: aiGenerated ? now : null,
    updatedAt: now,
  });
  return id;
}
