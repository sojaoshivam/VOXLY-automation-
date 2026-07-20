import { google } from "googleapis";
import { Readable } from "stream";

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

export function getYoutubeOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );
}

/** Build the consent URL. `state` is an opaque string we verify on callback. */
export function getYoutubeAuthUrl(state) {
  const client = getYoutubeOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: YOUTUBE_SCOPES,
    state,
  });
}

/** Exchange an auth code for tokens + the connected channel's name/id. */
export async function exchangeYoutubeCode(code) {
  const client = getYoutubeOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const youtube = google.youtube({ version: "v3", auth: client });
  const { data } = await youtube.channels.list({ part: ["snippet"], mine: true });
  const channel = data.items?.[0];

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    accountName: channel?.snippet?.title ?? "YouTube channel",
    platformAccountId: channel?.id ?? null,
  };
}

/** Refresh an access token. Returns the new access token + expiry. */
export async function refreshYoutubeToken(refreshToken) {
  const client = getYoutubeOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  return {
    accessToken: credentials.access_token,
    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
  };
}

/**
 * Download the MP4 from a public URL and upload it to YouTube as a Short.
 * Returns the new video id.
 */
export async function uploadYoutubeShort({
  accessToken,
  refreshToken,
  videoUrl,
  title,
  description,
  tags = [],
  privacyStatus = "public",
}) {
  const client = getYoutubeOAuthClient();
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  const youtube = google.youtube({ version: "v3", auth: client });

  const res = await fetch(videoUrl);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to fetch video from R2 (${res.status})`);
  }
  const body = Readable.fromWeb(res.body);

  // Ensure #Shorts is present so YouTube classifies vertical <60s clips as Shorts.
  const shortsTitle = /#shorts/i.test(title) ? title : `${title} #Shorts`;

  const { data } = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title: shortsTitle.slice(0, 100), description, tags },
      status: { privacyStatus, selfDeclaredMadeForKids: false },
    },
    media: { body },
  });

  return data.id;
}
