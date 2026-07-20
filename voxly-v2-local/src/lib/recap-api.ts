import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { videoProjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isMovieRecapProject } from "@/lib/recap-types";

export async function getRecapProject(projectId: string) {
  const [project] = await db
    .select()
    .from(videoProjects)
    .where(eq(videoProjects.id, projectId))
    .limit(1);

  if (!project) return null;
  if (!isMovieRecapProject(project.projectType)) return null;
  return project;
}

export function recapError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function resolvePublicPath(webPath: string): string {
  return path.join(process.cwd(), "public", webPath.replace(/^\//, ""));
}

export async function assertRecapProject(projectId: string) {
  const project = await getRecapProject(projectId);
  if (!project) {
    return { project: null, response: recapError("Movie recap project not found", 404) };
  }
  return { project, response: null };
}
