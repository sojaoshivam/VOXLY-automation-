const PLATFORM_LABELS = {
  youtube: "YouTube",
  instagram: "Instagram",
};

function postSortValue(post) {
  const posted = post.postedAt ? new Date(post.postedAt).getTime() : 0;
  const created = post.createdAt ? new Date(post.createdAt).getTime() : 0;
  return Math.max(posted, created);
}

/** Latest post per platform (handles re-posts). */
export function getLatestPostsByPlatform(posts = []) {
  const byPlatform = new Map();

  for (const post of posts) {
    const existing = byPlatform.get(post.platform);
    if (!existing || postSortValue(post) > postSortValue(existing)) {
      byPlatform.set(post.platform, post);
    }
  }

  return byPlatform;
}

export function isCloudReady(project) {
  return project.status === "uploaded" && Boolean(project.cloudExportUrl);
}

/**
 * Compute per-project publish coverage against the user's connected platforms.
 */
export function getPublishCoverage({ project, connectedPlatforms = [], postsForProject = [] }) {
  const latestByPlatform = getLatestPostsByPlatform(postsForProject);
  const connected = [...new Set(connectedPlatforms)];

  const postedPlatforms = [];
  const missingPlatforms = [];
  const platformStatus = {};

  for (const platform of connected) {
    const latest = latestByPlatform.get(platform);
    const status = latest?.status ?? null;
    platformStatus[platform] = {
      status,
      postedAt: latest?.postedAt ?? null,
      platformPostId: latest?.platformPostId ?? null,
    };

    if (status === "posted") {
      postedPlatforms.push(platform);
    } else {
      missingPlatforms.push(platform);
    }
  }

  const hasFailed = [...latestByPlatform.values()].some((p) => p.status === "failed");
  const hasPublishing = [...latestByPlatform.values()].some((p) => p.status === "publishing");
  const hasScheduled = [...latestByPlatform.values()].some((p) => p.status === "scheduled");

  const cloudReady = isCloudReady(project);
  const isFullyPublished =
    connected.length > 0 && missingPlatforms.length === 0 && postedPlatforms.length === connected.length;

  let coverage = "none";
  if (connected.length === 0) {
    coverage = postedPlatforms.length > 0 ? "partial" : "none";
  } else if (isFullyPublished) {
    coverage = "complete";
  } else if (postedPlatforms.length > 0) {
    coverage = "partial";
  }

  const displayStatus = getDisplayStatus({
    cloudReady,
    isFullyPublished,
    coverage,
    hasFailed,
    hasPublishing,
    hasScheduled,
    project,
  });

  return {
    postedPlatforms,
    missingPlatforms,
    platformStatus,
    coverage,
    isFullyPublished,
    hasFailed,
    hasPublishing,
    hasScheduled,
    displayStatus,
    needsPublishing: cloudReady && !isFullyPublished,
  };
}

function getDisplayStatus({
  cloudReady,
  isFullyPublished,
  coverage,
  hasFailed,
  hasPublishing,
  hasScheduled,
  project,
}) {
  if (hasFailed) return "failed";
  if (hasPublishing) return "processing";
  if (hasScheduled) return "scheduled";
  if (isFullyPublished) return "published_all";
  if (coverage === "partial") return "partial";
  if (cloudReady) return "ready";
  if (project.status === "uploading") return "processing";
  return project.status || "draft";
}

export function getPlatformLabel(platform) {
  return PLATFORM_LABELS[platform] || platform;
}

export function getPlatformViewUrl(platform, platformPostId) {
  if (!platformPostId) return null;
  if (platform === "youtube") {
    return `https://www.youtube.com/shorts/${platformPostId}`;
  }
  if (platform === "instagram") {
    return `https://www.instagram.com/reel/${platformPostId}/`;
  }
  return null;
}

/** Aggregate counts across projects for summary UI. */
export function getCoverageSummary(assets) {
  const needsPublishing = assets.filter((a) => a.coverage?.needsPublishing).length;
  const publishedAll = assets.filter((a) => a.coverage?.isFullyPublished).length;
  const partial = assets.filter((a) => a.coverage?.coverage === "partial").length;

  return { needsPublishing, publishedAll, partial };
}
