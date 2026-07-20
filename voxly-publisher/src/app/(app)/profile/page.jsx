import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import PageHeader from "@/components/PageHeader";
import ProfileForm from "@/components/ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, session.user.id))
    .limit(1);

  const initialProfile = profile || {
    displayName: session.user.name || "",
    bio: "",
    timezone: "America/New_York",
    emailNotifications: true,
    publishReminders: true,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Profile"
        title="Your profile"
        description="Manage your display name, timezone, and notification preferences."
      />
      <ProfileForm
        initialProfile={initialProfile}
        email={session.user.email || ""}
        image={session.user.image || ""}
      />
    </div>
  );
}
