import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { requireUserId } from "@/lib/session";

const DEFAULTS = {
  aiAutoGenerate: false,
  aiModel: "openai/gpt-4o-mini",
  defaultVisibility: "public",
  defaultCategory: "Short-form",
  autoPublishEnabled: false,
  autoPublishPlatforms: '["youtube","instagram"]',
  autoPublishScheduleMode: "interval",
  autoPublishIntervalHours: 6,
};

function clampIntervalHours(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n)) return DEFAULTS.autoPublishIntervalHours;
  return Math.max(1, Math.min(168, Math.round(n)));
}

export async function GET() {
  try {
    const userId = await requireUserId();
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    return NextResponse.json({ settings: settings || { userId, ...DEFAULTS } });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}

export async function PATCH(request) {
  try {
    const userId = await requireUserId();
    const body = await request.json();

    const [existing] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    const values = {
      aiAutoGenerate: body.aiAutoGenerate ?? existing?.aiAutoGenerate ?? DEFAULTS.aiAutoGenerate,
      aiModel: body.aiModel ?? existing?.aiModel ?? DEFAULTS.aiModel,
      defaultVisibility: body.defaultVisibility ?? existing?.defaultVisibility ?? DEFAULTS.defaultVisibility,
      defaultCategory: body.defaultCategory ?? existing?.defaultCategory ?? DEFAULTS.defaultCategory,
      autoPublishEnabled:
        body.autoPublishEnabled ?? existing?.autoPublishEnabled ?? DEFAULTS.autoPublishEnabled,
      autoPublishPlatforms:
        body.autoPublishPlatforms ?? existing?.autoPublishPlatforms ?? DEFAULTS.autoPublishPlatforms,
      autoPublishScheduleMode:
        body.autoPublishScheduleMode ??
        existing?.autoPublishScheduleMode ??
        DEFAULTS.autoPublishScheduleMode,
      autoPublishIntervalHours: clampIntervalHours(
        body.autoPublishIntervalHours ??
          existing?.autoPublishIntervalHours ??
          DEFAULTS.autoPublishIntervalHours
      ),
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(userSettings).set(values).where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings).values({ userId, ...values });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
