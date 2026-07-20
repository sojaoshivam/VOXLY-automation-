import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { socialAccounts, videoProjects } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { uploadYoutubeShort, refreshYoutubeToken } from "@/lib/youtube";
import { publishReel, refreshInstagramToken } from "@/lib/instagram";

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

function buildDescription(caption, hashtags) {
  const tagLine = (hashtags || "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .join(" ");
  return [caption, tagLine].filter(Boolean).join("\n\n");
}

async function getReadyProject(projectId) {
  const [project] = await db
    .select()
    .from(videoProjects)
    .where(eq(videoProjects.id, projectId))
    .limit(1);

  if (!project) throw new Error("Project not found");
  if (!project.cloudExportUrl) {
    throw new Error("Project has no public video URL (cloud_export_url) yet");
  }
  return project;
}

async function getAccount(userId, platform) {
  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(
      and(eq(socialAccounts.userId, userId), eq(socialAccounts.platform, platform))
    )
    .limit(1);

  if (!account) {
    throw new Error(`No connected ${platform} account. Connect one in /accounts.`);
  }
  return account;
}

/** Refresh a YouTube access token if it's expired/near-expiry, persisting the new token. */
async function ensureFreshYoutubeToken(account) {
  const expiresAt = account.tokenExpiresAt
    ? new Date(account.tokenExpiresAt).getTime()
    : 0;
  let accessToken = decrypt(account.accessToken);
  const refreshToken = account.refreshToken ? decrypt(account.refreshToken) : null;

  if (refreshToken && expiresAt - Date.now() < REFRESH_BUFFER_MS) {
    const refreshed = await refreshYoutubeToken(refreshToken);
    accessToken = refreshed.accessToken;
    await db
      .update(socialAccounts)
      .set({
        accessToken: encrypt(accessToken),
        tokenExpiresAt: refreshed.expiresAt,
      })
      .where(eq(socialAccounts.id, account.id));
  }

  return { accessToken, refreshToken };
}

/** Refresh an Instagram token if it's expired/near-expiry, persisting the new token. */
async function ensureFreshInstagramToken(account) {
  const expiresAt = account.tokenExpiresAt
    ? new Date(account.tokenExpiresAt).getTime()
    : 0;
  let accessToken = decrypt(account.accessToken);

  if (expiresAt && expiresAt - Date.now() < REFRESH_BUFFER_MS) {
    const refreshed = await refreshInstagramToken(accessToken);
    accessToken = refreshed.accessToken;
    await db
      .update(socialAccounts)
      .set({
        accessToken: encrypt(accessToken),
        tokenExpiresAt: refreshed.expiresAt,
      })
      .where(eq(socialAccounts.id, account.id));
  }

  return accessToken;
}

/**
 * Publish a project to a single platform now. Returns { platformPostId }.
 * Throws on any failure (caller records the error).
 */
export async function publishToPlatform({ userId, projectId, platform, caption, hashtags }) {
  const project = await getReadyProject(projectId);
  const account = await getAccount(userId, platform);

  if (platform === "youtube") {
    const { accessToken, refreshToken } = await ensureFreshYoutubeToken(account);
    const platformPostId = await uploadYoutubeShort({
      accessToken,
      refreshToken,
      videoUrl: project.cloudExportUrl,
      title: caption?.trim() || project.title,
      description: buildDescription(caption, hashtags),
      tags: (hashtags || "")
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#/, ""))
        .filter(Boolean),
    });
    return { platformPostId };
  }

  if (platform === "instagram") {
    const accessToken = await ensureFreshInstagramToken(account);
    const platformPostId = await publishReel({
      igUserId: account.platformAccountId,
      accessToken,
      videoUrl: project.cloudExportUrl,
      caption: buildDescription(caption, hashtags),
    });
    return { platformPostId };
  }

  throw new Error(`Unsupported platform: ${platform}`);
}
