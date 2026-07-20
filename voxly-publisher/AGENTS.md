# Voxly Publisher — Build Guide
> Last updated: 2026-06-03
> Sibling app to `voxly-v2-local`. This is the **publishing / scheduling** app referenced in that repo's AGENTS.md.

## Purpose

Take the rendered vertical videos that `voxly-v2-local` uploaded to Cloudflare R2 and **publish them to YouTube (Shorts) and Instagram (Reels)** — manually or on a schedule.

This app does **no** video processing (no FFmpeg, no transcription). It only:
1. Reads finished videos from the shared database.
2. Connects social accounts via OAuth.
3. Uploads/publishes the public R2 video URL to each platform.
4. Tracks post status & scheduling.

## How it connects to `voxly-v2-local`

The two apps share **one Neon Postgres database** (same `DATABASE_URL`).

- `voxly-v2-local` writes to `video_projects`. A video is ready to publish when:
  - `status = 'uploaded'`
  - `cloud_export_url` is set (a public `https://pub-xxxxx.r2.dev/exports/<id>.mp4` link)
- This app **reads** those rows and publishes `cloud_export_url`.
- Do NOT modify `video_projects` columns owned by the local app; add new tables for publishing state.

Existing `video_projects` schema (read-only reference — see `voxly-v2-local/src/db/schema.ts`):
`id, title, localVideoPath, localAudioPath, transcriptData, finalExportPath, cloudExportUrl, backgroundOption, status, createdAt`

## New tables this app owns

- `social_accounts` — connected platform accounts (per user): `id, userId, platform ('youtube'|'instagram'), accountName, accessToken, refreshToken, tokenExpiresAt, platformAccountId, createdAt`
- `scheduled_posts` — `id, projectId (-> video_projects.id), platform, caption, hashtags, status ('draft'|'scheduled'|'publishing'|'posted'|'failed'), scheduledAt, postedAt, platformPostId, errorMessage, createdAt`

Store OAuth tokens encrypted at rest. Never expose tokens to the client.

## Tech stack (follow user boilerplate rules)

- Next.js App Router (JavaScript, RSC-first; minimize `use client`)
- Tailwind CSS + DaisyUI
- NextAuth (app login)
- Drizzle ORM + Neon Postgres
- Deploy on **Vercel**; use **Vercel Cron** to fire scheduled posts.

## Platform integration notes

### YouTube (Shorts)
- API: **YouTube Data API v3** `videos.insert` (resumable upload).
- OAuth scope: `https://www.googleapis.com/auth/youtube.upload`.
- Flow: download the MP4 from `cloud_export_url`, stream it to the resumable upload endpoint with snippet (title, description, tags) + status (privacyStatus).
- Vertical <60s + `#Shorts` in title/description → treated as a Short.
- Creds already provisioned in `voxly-v2-local/.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (a.k.a. `YOUTUBE_CLIENT_ID/SECRET`).

### Instagram (Reels)
- API: **Instagram Graph API** (requires an Instagram **Business/Creator** account linked to a Facebook Page).
- Reels publishing is a 2-step container flow:
  1. `POST /{ig-user-id}/media` with `media_type=REELS`, `video_url=<public R2 url>`, `caption`.
  2. Poll container `status_code` until `FINISHED`, then `POST /{ig-user-id}/media_publish` with the creation id.
- IG fetches the video from a **publicly reachable URL** → our R2 public URL works directly (no upload streaming needed).
- Creds already provisioned in `voxly-v2-local/.env`: `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`.

## Env vars needed (`.env.example` to create)

```
DATABASE_URL=            # SAME Neon DB as voxly-v2-local
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3001   # run on a different port than local app (3000)

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
YOUTUBE_REDIRECT_URI=http://localhost:3001/api/auth/youtube/callback

FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
INSTAGRAM_REDIRECT_URI=http://localhost:3001/api/auth/instagram/callback

TOKEN_ENCRYPTION_KEY=    # for encrypting stored access/refresh tokens
CRON_SECRET=             # protects the Vercel cron endpoint
```

> Note: `voxly-v2-local` runs on port 3000. Run this app on **3001** to develop both at once.

## Planned routes

| Path | Purpose |
|------|---------|
| `/` | Dashboard: ready-to-publish videos + recent posts |
| `/accounts` | Connect / manage YouTube & Instagram accounts |
| `/publish/[projectId]` | Compose caption/hashtags, pick platforms, post now or schedule |
| `/schedule` | Calendar/list of scheduled & posted items |

## Planned APIs

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/youtube` + `/callback` | GET | YouTube OAuth |
| `/api/auth/instagram` + `/callback` | GET | Instagram OAuth |
| `/api/social-accounts` | GET/DELETE | List/remove connected accounts |
| `/api/projects/ready` | GET | `video_projects` where status=uploaded |
| `/api/publish` | POST | Post now (one or many platforms) |
| `/api/schedule` | POST/GET/DELETE | CRUD scheduled posts |
| `/api/cron/process-posts` | GET | Vercel cron: publish due `scheduled_posts` (guard with `CRON_SECRET`) |

## Build milestones

1. Scaffold Next.js app (App Router, Tailwind, DaisyUI), connect to shared Neon DB via Drizzle.
2. Define `social_accounts` + `scheduled_posts` tables + migration.
3. App auth with NextAuth.
4. Dashboard listing ready videos (read `video_projects`).
5. YouTube OAuth connect + `videos.insert` publish.
6. Instagram OAuth connect + Reels container publish.
7. Manual "post now" composer.
8. Scheduling + Vercel cron processor.

## Gotchas

- IG video URL must stay public & reachable while IG ingests it → keep R2 public access enabled.
- Refresh OAuth tokens before publishing (YouTube tokens expire ~1h; IG long-lived tokens ~60d).
- Validate video specs per platform (aspect ratio, duration, codec) before posting.
- Keep secrets server-side only; tokens encrypted in DB.
