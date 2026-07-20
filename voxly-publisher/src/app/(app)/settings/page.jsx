import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import PageHeader from "@/components/PageHeader";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="App preferences"
        description="Configure AI generation, auto-publish, and publishing defaults."
      />
      <SettingsForm initialSettings={settings || {}} />
    </div>
  );
}
