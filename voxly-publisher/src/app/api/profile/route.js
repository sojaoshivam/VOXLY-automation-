import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { requireUserId } from "@/lib/session";

export async function GET() {
  try {
    const userId = await requireUserId();
    const session = await auth();

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    return NextResponse.json({
      profile: profile || {
        userId,
        displayName: session?.user?.name || "",
        bio: "",
        timezone: "America/New_York",
        emailNotifications: true,
        publishReminders: true,
      },
      email: session?.user?.email || "",
      image: session?.user?.image || "",
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}

export async function PATCH(request) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const { displayName, bio, timezone, emailNotifications, publishReminders } = body;

    const [existing] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    const values = {
      displayName: displayName ?? existing?.displayName,
      bio: bio ?? existing?.bio,
      timezone: timezone ?? existing?.timezone ?? "America/New_York",
      emailNotifications: emailNotifications ?? existing?.emailNotifications ?? true,
      publishReminders: publishReminders ?? existing?.publishReminders ?? true,
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(userProfiles).set(values).where(eq(userProfiles.userId, userId));
    } else {
      await db.insert(userProfiles).values({ userId, ...values });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
