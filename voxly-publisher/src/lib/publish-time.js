const PLATFORM_SLOTS = {
  youtube: [
    { day: 2, hour: 12, label: "Tuesday 12:00 PM" },
    { day: 2, hour: 19, label: "Tuesday 7:00 PM" },
    { day: 3, hour: 14, label: "Wednesday 2:00 PM" },
    { day: 4, hour: 12, label: "Thursday 12:00 PM" },
    { day: 4, hour: 20, label: "Thursday 8:00 PM" },
    { day: 5, hour: 11, label: "Friday 11:00 AM" },
    { day: 6, hour: 10, label: "Saturday 10:00 AM" },
  ],
  instagram: [
    { day: 1, hour: 11, label: "Monday 11:00 AM" },
    { day: 2, hour: 13, label: "Tuesday 1:00 PM" },
    { day: 3, hour: 11, label: "Wednesday 11:00 AM" },
    { day: 4, hour: 19, label: "Thursday 7:00 PM" },
    { day: 5, hour: 12, label: "Friday 12:00 PM" },
    { day: 0, hour: 18, label: "Sunday 6:00 PM" },
  ],
};

const PLATFORM_TIPS = {
  youtube:
    "YouTube Shorts perform best mid-week (Tue–Thu) during lunch (12–3 PM) and evening (7–9 PM) in your audience's timezone.",
  instagram:
    "Instagram Reels see higher reach on weekdays late morning and early evening; test Monday/Wednesday 11 AM and Thursday 7 PM.",
};

function nextSlotFromNow(slots, now = new Date()) {
  const candidates = [];

  for (let weekOffset = 0; weekOffset < 3; weekOffset += 1) {
    for (const slot of slots) {
      const candidate = new Date(now);
      const currentDay = candidate.getDay();
      let daysUntil = (slot.day - currentDay + 7) % 7;
      if (weekOffset > 0) daysUntil += weekOffset * 7;
      if (daysUntil === 0 && candidate.getHours() >= slot.hour) daysUntil = 7;

      candidate.setDate(candidate.getDate() + daysUntil);
      candidate.setHours(slot.hour, 0, 0, 0);

      if (candidate > now) candidates.push({ at: candidate, label: slot.label });
    }
  }

  candidates.sort((a, b) => a.at - b.at);
  return candidates[0] || null;
}

/** Next publish slot for a platform using built-in reach heuristics. */
export function getHeuristicPublishTime(platform, now = new Date()) {
  const slots = PLATFORM_SLOTS[platform] || PLATFORM_SLOTS.youtube;
  const next = nextSlotFromNow(slots, now);
  return {
    scheduledAt: next?.at ?? new Date(now.getTime() + 60 * 60 * 1000),
    label: next?.label ?? "Soon",
    reason: PLATFORM_TIPS[platform] || PLATFORM_TIPS.youtube,
  };
}

export function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/** Latest scheduled or posted time for a user (used to space interval posts). */
export function getLatestQueueTime(posts = [], now = new Date()) {
  let latest = null;

  for (const post of posts) {
    const times = [post.postedAt, post.scheduledAt, post.createdAt]
      .filter(Boolean)
      .map((t) => new Date(t).getTime());

    for (const t of times) {
      if (!latest || t > latest) latest = t;
    }
  }

  return latest ? new Date(latest) : null;
}

/** Compute the first slot for interval-based auto-publish. */
export function getNextIntervalSlot({ lastQueueTime, intervalHours, now = new Date() }) {
  const hours = Math.max(1, Math.min(168, intervalHours || 6));
  const minFuture = addHours(now, 0);

  if (!lastQueueTime) return minFuture;

  const nextFromLast = addHours(lastQueueTime, hours);
  return nextFromLast > now ? nextFromLast : minFuture;
}

export function suggestPublishTimes(platforms = ["youtube", "instagram"]) {
  const now = new Date();
  const suggestions = platforms.map((platform) => {
    const heuristic = getHeuristicPublishTime(platform, now);
    return {
      platform,
      suggestedAt: heuristic.scheduledAt.toISOString(),
      label: heuristic.label,
      tip: heuristic.reason,
    };
  });

  const primary = suggestions.reduce((best, current) => {
    if (!current.suggestedAt) return best;
    if (!best?.suggestedAt) return current;
    return new Date(current.suggestedAt) < new Date(best.suggestedAt) ? current : best;
  }, null);

  return {
    primary,
    suggestions,
    generalTip:
      "Post when your audience is active. Short-form video peaks on weekdays; avoid late-night slots unless your niche is global.",
  };
}
