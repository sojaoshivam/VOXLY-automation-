# Voxly Publisher

Publishing & scheduling companion to `voxly-v2-local`. It reads finished videos
(uploaded to Cloudflare R2) from the **shared Neon Postgres database** and
publishes them to **YouTube (Shorts)** and **Instagram (Reels)** — manually or
on a schedule.

This app does **no** video processing. It only connects social accounts, reads
ready videos, and publishes the public R2 URL.

## Stack

- Next.js App Router (JavaScript, RSC-first)
- Tailwind CSS + DaisyUI
- NextAuth (Google sign-in)
- Drizzle ORM + Neon Postgres (`pg`)
- Vercel + Vercel Cron for scheduled posts

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env and fill it in (see `.env.example` for guidance):

```bash
cp .env.example .env.local
```

Generate secrets:

```bash
openssl rand -base64 32   # NEXTAUTH_SECRET
openssl rand -hex 32      # TOKEN_ENCRYPTION_KEY
openssl rand -hex 32      # CRON_SECRET
```

3. Create this app's tables (only `social_accounts` + `scheduled_posts`; the
   `video_projects` table is owned by `voxly-v2-local` and is never altered):

```bash
npm run db:push
```

4. Run the dev server (port **3001** so it can run alongside `voxly-v2-local` on 3000):

```bash
npm run dev
```

## OAuth provider setup

### Google (login + YouTube)
- Enable **YouTube Data API v3**.
- Authorized redirect URIs:
  - `http://localhost:3001/api/auth/callback/google` (app login)
  - `http://localhost:3001/api/auth/youtube/callback` (YouTube connect)

### Instagram (Meta)
- Needs an **Instagram Business/Creator** account linked to a **Facebook Page**.
- App needs `instagram_content_publish` (+ `pages_show_list`, `instagram_basic`).
- Valid OAuth Redirect URI: `http://localhost:3001/api/auth/instagram/callback`.

## How publishing works

- **YouTube**: downloads the MP4 from `cloud_export_url` and streams it to
  `videos.insert`. `#Shorts` is auto-appended so vertical <60s clips become Shorts.
- **Instagram**: creates a `REELS` media container pointing at the public R2 URL,
  polls until `FINISHED`, then publishes. The R2 URL must stay public & reachable.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Dashboard: ready-to-publish videos + recent posts |
| `/accounts` | Connect / manage YouTube & Instagram accounts |
| `/publish/[projectId]` | Compose caption/hashtags, pick platforms, post now or schedule |
| `/schedule` | Scheduled & posted history |

## Cron

`vercel.json` runs `/api/cron/process-posts` every 5 minutes. It publishes any
`scheduled_posts` whose `scheduledAt` is due. The endpoint is guarded by
`CRON_SECRET` (Vercel sends it as a Bearer token automatically).
