"use server";

import { db } from "@/db";
import { videoProjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";

export async function deleteProject(projectId: string) {
  try {
    // 1. Fetch the project record to find associated files
    const [project] = await db
      .select()
      .from(videoProjects)
      .where(eq(videoProjects.id, projectId))
      .limit(1);

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    // 2. Delete the physical source video file
    if (project.localVideoPath) {
      const videoPath = path.join(process.cwd(), "public", project.localVideoPath);
      if (fs.existsSync(videoPath)) {
        try {
          fs.unlinkSync(videoPath);
        } catch (e) {
          console.error(`Failed to delete source video file at ${videoPath}:`, e);
        }
      }
    }

    // 3. Delete the physical source audio file (if present)
    if (project.localAudioPath) {
      const audioPath = path.join(process.cwd(), "public", project.localAudioPath);
      if (fs.existsSync(audioPath)) {
        try {
          fs.unlinkSync(audioPath);
        } catch (e) {
          console.error(`Failed to delete background audio file at ${audioPath}:`, e);
        }
      }
    }

    // 4. Delete the final rendered export file (if present)
    if (project.finalExportPath) {
      const exportPath = path.join(process.cwd(), "public", project.finalExportPath);
      if (fs.existsSync(exportPath)) {
        try {
          fs.unlinkSync(exportPath);
        } catch (e) {
          console.error(`Failed to delete final rendered export at ${exportPath}:`, e);
        }
      }
    }

    // 5. Delete the project record from Postgres
    await db
      .delete(videoProjects)
      .where(eq(videoProjects.id, projectId));

    // 6. Revalidate pages in the Next.js router cache to refresh the client instantly
    revalidatePath("/");
    revalidatePath("/projects");

    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete project:", error);
    return { success: false, error: error?.message || "Failed to delete project." };
  }
}
