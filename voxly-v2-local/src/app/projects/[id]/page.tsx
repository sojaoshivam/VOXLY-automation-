import { db } from "@/db";
import { videoProjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ProjectEditor } from "@/components/ProjectEditor";
import { MovieRecapEditor } from "@/components/MovieRecapEditor";
import { isMovieRecapProject } from "@/lib/recap-types";

export const dynamic = "force-dynamic";

export default async function ProjectEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project] = await db
    .select()
    .from(videoProjects)
    .where(eq(videoProjects.id, id))
    .limit(1);

  if (!project) notFound();

  if (isMovieRecapProject(project.projectType)) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <MovieRecapEditor
          projectId={project.id}
          title={project.title}
          localVideoPath={project.localVideoPath}
          cloudExportUrl={project.cloudExportUrl}
          sourceTranscriptData={project.sourceTranscriptData}
          recapScriptData={project.recapScriptData}
          commentaryAudioPath={project.commentaryAudioPath}
          transcriptData={project.transcriptData}
        />
      </div>
    );
  }

  const bg = (project.backgroundOption || "blur") as "blur" | "white" | "black";

  return (
    <div className="p-8 max-w-lg mx-auto">
      <ProjectEditor
        projectId={project.id}
        title={project.title}
        localVideoPath={project.localVideoPath}
        cloudExportUrl={project.cloudExportUrl}
        initialBackground={bg}
      />
    </div>
  );
}
