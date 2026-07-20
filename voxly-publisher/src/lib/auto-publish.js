import crypto from "crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  scheduledPosts,
  socialAccounts,
  userProfiles,
  userSettings,
  videoProjects,
} from "@/db/schema";
import { suggestOptimalPublishTime, generateMetadata } from "@/lib/ai";
import { getProjectMetadata, upsertProjectMetadata } from "@/lib/project-metadata";
import {
  addHours,
  getHeuristicPublishTime,
  getLatestQueueTime,
  getNextIntervalSlot,
} from "@/lib/publish-time";

const SUPPORTED_PLATFORMS = ["youtube", "instagram"];
const SKIP_STATUSES = new Set(["posted", "publishing", "scheduled"]);

function parsePlatforms(raw) {
  if (!raw) return ["youtube", "instagram"];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => SUPPORTED_PLATFORMS.includes(p));
  } catch {
    return [];
  }
}

function clampIntervalHours(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n)) return 6;
  return Math.max(1, Math.min(168, Math.round(n)));
}

async function resolvePublishMetadata({ settings, project, userId }) {
  const saved = await getProjectMetadata(project.id, userId);
  if (saved?.caption) {
    return {
      caption: saved.caption || project.title,
      hashtags: saved.hashtags || "",
    };
  }

  if (settings.aiAutoGenerate && project.transcriptData) {
    try {
      const result = await generateMetadata({
        transcriptData: project.transcriptData,
        model: settings.aiModel,
      });
      await upsertProjectMetadata({
        projectId: project.id,
        userId,
        title: result.title || project.title,
        caption: result.caption,
        hashtags: result.hashtags,
        aiGenerated: true,
      });
      return {
        caption: result.caption || project.title,
        hashtags: result.hashtags || "",
      };
    } catch {
      // Fall back to project title when AI is unavailable or fails.
    }
  }

  return { caption: project.title, hashtags: "" };
}

function getPendingPairs({ projects, posts, platforms }) {
  const pending = [];

  for (const project of projects) {
    for (const platform of platforms) {
      const alreadyHandled = posts.some(
        (post) =>
          post.projectId === project.id &&
          post.platform === platform &&
          SKIP_STATUSES.has(post.status)
      );
      if (!alreadyHandled) {
        pending.push({ project, platform });
      }
    }
  }

  return pending;
}

/** Group pending items by project, oldest cloud-ready video first. */
function groupPendingByProject(pending) {
  const byProject = new Map();

  for (const item of pending) {
    const list = byProject.get(item.project.id) || [];
    list.push(item);
    byProject.set(item.project.id, list);
  }

  return [...byProject.entries()]
    .sort(([, a], [, b]) => {
      const aCreated = a[0].project.createdAt || 0;
      const bCreated = b[0].project.createdAt || 0;
      return aCreated - bCreated;
    })
    .map(([, items]) => items);
}

async function resolveScheduledTime({
  mode,
  intervalHours,
  slotTime,
  platform,
  project,
  settings,
  timezone,
}) {
  if (mode === "ai_optimal") {
    try {
      return await suggestOptimalPublishTime({
        platform,
        timezone,
        title: project.title,
        transcriptData: project.transcriptData,
        model: settings.aiModel,
      });
    } catch {
      const fallback = getHeuristicPublishTime(platform);
      return {
        scheduledAt: fallback.scheduledAt,
        label: fallback.label,
        reason: fallback.reason,
      };
    }
  }

  return {
    scheduledAt: slotTime,
    label: slotTime.toLocaleString(undefined, { timeZone: timezone }),
    reason: `Auto-publish every ${intervalHours} hour${intervalHours === 1 ? "" : "s"}`,
  };
}

/**
 * Schedule cloud-ready videos for users with auto-publish enabled.
 * Posts are published by the process-posts cron when scheduledAt is due.
 */
export async function processAutoPublish() {
  const enabledUsers = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.autoPublishEnabled, true));

  const results = [];

  for (const settings of enabledUsers) {
    const platforms = parsePlatforms(settings.autoPublishPlatforms);
    if (platforms.length === 0) continue;

    const accounts = await db
      .select({ platform: socialAccounts.platform })
      .from(socialAccounts)
      .where(eq(socialAccounts.userId, settings.userId));

    const connectedPlatforms = platforms.filter((p) =>
      accounts.some((a) => a.platform === p)
    );
    if (connectedPlatforms.length === 0) continue;

    const [profile] = await db
      .select({ timezone: userProfiles.timezone })
      .from(userProfiles)
      .where(eq(userProfiles.userId, settings.userId))
      .limit(1);

    const timezone = profile?.timezone || "America/New_York";
    const mode = settings.autoPublishScheduleMode === "ai_optimal" ? "ai_optimal" : "interval";
    const intervalHours = clampIntervalHours(settings.autoPublishIntervalHours);

    const [projects, posts] = await Promise.all([
      db
        .select()
        .from(videoProjects)
        .where(
          and(
            eq(videoProjects.status, "uploaded"),
            isNotNull(videoProjects.cloudExportUrl)
          )
        ),
      db
        .select()
        .from(scheduledPosts)
        .where(eq(scheduledPosts.userId, settings.userId)),
    ]);

    const pending = getPendingPairs({
      projects,
      posts,
      platforms: connectedPlatforms,
    });

    if (pending.length === 0) continue;

    const projectGroups = groupPendingByProject(pending);
    const lastQueueTime = getLatestQueueTime(posts);
    let slotTime = getNextIntervalSlot({ lastQueueTime, intervalHours });

    for (const group of projectGroups) {
      const { caption, hashtags } = await resolvePublishMetadata({
        settings,
        project: group[0].project,
        userId: settings.userId,
      });

      for (const { project, platform } of group) {
        const timing = await resolveScheduledTime({
          mode,
          intervalHours,
          slotTime,
          platform,
          project,
          settings,
          timezone,
        });

        const postId = crypto.randomUUID();
        await db.insert(scheduledPosts).values({
          id: postId,
          userId: settings.userId,
          projectId: project.id,
          platform,
          caption,
          hashtags,
          status: "scheduled",
          scheduledAt: timing.scheduledAt,
        });

        results.push({
          userId: settings.userId,
          projectId: project.id,
          platform,
          status: "scheduled",
          scheduledAt: timing.scheduledAt.toISOString(),
          label: timing.label,
          reason: timing.reason,
          mode,
        });
      }

      if (mode === "interval") {
        slotTime = addHours(slotTime, intervalHours);
      }
    }
  }

  return results;
}
