const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const OAUTH_DIALOG = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

const IG_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
];

export function getInstagramAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_CLIENT_ID,
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
    state,
    scope: IG_SCOPES.join(","),
    response_type: "code",
  });
  return `${OAUTH_DIALOG}?${params.toString()}`;
}

async function graphGet(path, params) {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Graph GET ${path} failed`);
  }
  return json;
}

async function graphPost(path, params) {
  const url = new URL(`${GRAPH}/${path}`);
  const body = new URLSearchParams(params);
  const res = await fetch(url, { method: "POST", body });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Graph POST ${path} failed`);
  }
  return json;
}

/**
 * Exchange the OAuth code for a long-lived user token, then resolve the
 * linked Instagram Business account.
 */
export async function exchangeInstagramCode(code) {
  const short = await graphGet("oauth/access_token", {
    client_id: process.env.FACEBOOK_CLIENT_ID,
    client_secret: process.env.FACEBOOK_CLIENT_SECRET,
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
    code,
  });

  const long = await graphGet("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: process.env.FACEBOOK_CLIENT_ID,
    client_secret: process.env.FACEBOOK_CLIENT_SECRET,
    fb_exchange_token: short.access_token,
  });

  const accessToken = long.access_token;
  const expiresAt = long.expires_in
    ? new Date(Date.now() + long.expires_in * 1000)
    : null;

  const { igUserId, accountName } = await resolveInstagramAccount(accessToken);

  return { accessToken, refreshToken: null, expiresAt, accountName, platformAccountId: igUserId };
}

/** Refresh a long-lived Instagram user token before it expires (~60 days). */
export async function refreshInstagramToken(accessToken) {
  const long = await graphGet("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: process.env.FACEBOOK_CLIENT_ID,
    client_secret: process.env.FACEBOOK_CLIENT_SECRET,
    fb_exchange_token: accessToken,
  });

  return {
    accessToken: long.access_token,
    expiresAt: long.expires_in
      ? new Date(Date.now() + long.expires_in * 1000)
      : null,
  };
}

/** Find the IG Business account id behind the user's first linked Facebook Page. */
export async function resolveInstagramAccount(accessToken) {
  const pages = await graphGet("me/accounts", {
    fields: "name,instagram_business_account{username}",
    access_token: accessToken,
  });

  const page = pages.data?.find((p) => p.instagram_business_account);
  if (!page) {
    throw new Error(
      "No Instagram Business account is linked to your Facebook Pages. Link an IG Business/Creator account to a Page and reconnect."
    );
  }

  return {
    igUserId: page.instagram_business_account.id,
    accountName:
      page.instagram_business_account.username || page.name || "Instagram account",
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Publish a Reel via the 2-step container flow:
 * 1) create a REELS media container pointing at the public video URL,
 * 2) poll until FINISHED, then publish. Returns the published media id.
 */
export async function publishReel({ igUserId, accessToken, videoUrl, caption }) {
  const container = await graphPost(`${igUserId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption: caption || "",
    access_token: accessToken,
  });
  const creationId = container.id;

  // Poll the container until it finishes processing (or errors / times out).
  const maxAttempts = 30;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(5000);
    const status = await graphGet(creationId, {
      fields: "status_code,status",
      access_token: accessToken,
    });
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR") {
      throw new Error(`Instagram failed to process the video: ${status.status || ""}`);
    }
    if (attempt === maxAttempts - 1) {
      throw new Error("Timed out waiting for Instagram to process the video.");
    }
  }

  const published = await graphPost(`${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });

  return published.id;
}
