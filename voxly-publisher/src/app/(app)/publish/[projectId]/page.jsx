import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { videoProjects, socialAccounts, userSettings } from "@/db/schema";
import PublishComposer from "@/components/PublishComposer";
import PageHeader from "@/components/PageHeader";
import { getProjectMetadata } from "@/lib/project-metadata";

export const dynamic = "force-dynamic";

export default async function PublishPage({ params }) {
  const { projectId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [project] = await db
    .select()
    .from(videoProjects)
    .where(eq(videoProjects.id, projectId))
    .limit(1);

  if (!project) notFound();

  const [accounts, settings, savedMetadata] = await Promise.all([
    db
      .select({ platform: socialAccounts.platform, accountName: socialAccounts.accountName })
      .from(socialAccounts)
      .where(eq(socialAccounts.userId, session.user.id)),
    db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, session.user.id))
      .limit(1)
      .then((rows) => rows[0] || null),
    getProjectMetadata(projectId, session.user.id),
  ]);

  const connectedPlatforms = accounts.map((a) => a.platform);
  const hasTranscript = Boolean(project.transcriptData?.trim());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Create / Publish"
        title="Configure release"
        description={project.title}
      />
      <PublishComposer
        project={{
          id: project.id,
          title: project.title,
          cloudExportUrl: project.cloudExportUrl,
        }}
        connectedPlatforms={connectedPlatforms}
        savedMetadata={savedMetadata}
        hasTranscript={hasTranscript}
        defaults={settings}
        aiAutoGenerate={settings?.aiAutoGenerate ?? false}
      />
    </div>
  );
}
