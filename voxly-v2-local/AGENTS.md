# Voxly Local — Build Guide
> Last updated: 2026-06-11

## Two engines, one app

Voxly Local runs **two parallel pipelines** that share Postgres + R2 but use separate routes, editors, and Remotion compositions.

### Podcast Clips (existing — do not refactor)

1. **Ingest** — talking-head MP4 + optional BGM (`/studio`)
2. **Transcribe** — Deepgram (`/api/transcribe`)
3. **Edit & render** — `PodcastShort` + face framing + Pexels b-roll (`/api/render`)
4. **R2 upload** — `cloud_export_url` + `status=uploaded`

### Movie Clips (new)

1. **Ingest** — single movie scene MP4 ≤60s (`/movie-studio`)
2. **Transcribe clip** — Deepgram → `source_transcript_data` (`/api/recap/transcribe`)
3. **AI script** — LLM timed explainer (`/api/recap/generate-script`)
4. **Sarvam voice** — Bulbul v3 `en-IN` (`/api/recap/generate-voice`)
5. **Voiceover transcript** — Deepgram captions (`/api/recap/transcribe-voiceover`)
6. **Render** — `MovieRecapShort` (`/api/recap/render`) → R2

Full movie workflow: [`docs/MOVIE_RECAP_WORKFLOW.md`](docs/MOVIE_RECAP_WORKFLOW.md)

Scheduling, YouTube publishing, auth, and cron live in **voxly-publisher** (separate app).

---

### Routes

| Path | Engine | Purpose |
|------|--------|---------|
| `/` | Both | Dashboard (Podcast + Movie cards) |
| `/studio` | Podcast | Ingest + transcribe |
| `/movie-studio` | Movie | Movie clip ingest |
| `/projects` | Both | Project list (All / Podcast / Movie tabs) |
| `/projects/[id]` | Both | Routes to `ProjectEditor` or `MovieRecapEditor` |

### Podcast APIs (unchanged)

| Route | Method |
|-------|--------|
| `/api/upload` | POST |
| `/api/transcribe` | POST |
| `/api/render` | POST |
| `/api/render/status` | GET |
| `/api/bgm` | GET |

### Movie APIs

| Route | Method |
|-------|--------|
| `/api/recap/upload` | POST |
| `/api/recap/transcribe` | POST |
| `/api/recap/generate-script` | POST |
| `/api/recap/script` | PUT |
| `/api/recap/generate-voice` | POST |
| `/api/recap/transcribe-voiceover` | POST |
| `/api/recap/render` | POST |
| `/api/recap/render/status` | GET |

### Database

Table: `video_projects` with `project_type` (`podcast` | `movie_recap`) plus recap columns. Init: `npm run db:init` (runs all SQL in `src/db/migrations/`).

### Env (`.env.example`)

- `DATABASE_URL` — Neon Postgres
- `R2_*` — Cloudflare R2
- `DEEPGRAM_API_KEY` — transcription (mock without key)
- `GEMINI_API_KEY` / `OPENROUTER_API_KEY` — podcast b-roll + movie script
- `PEXELS_API_KEY` — podcast b-roll only
- `SARVAM_API_KEY` — movie voiceover (Bulbul v3)

### Remotion

| Composition | Engine | Script |
|-------------|--------|--------|
| `PodcastShort` | Podcast | `scripts/render-remotion.ts` |
| `MovieRecapShort` | Movie | `scripts/render-movie-recap.ts` |

- `npm run remotion:studio` — preview both compositions
- `npm run remotion:render` — podcast CLI
- `npm run remotion:render-movie` — movie CLI

**Important:** `remotion.config.ts` uses empty `remotion-public/`; media is served over local HTTP during render.

### Scripts

- `npm run dev` — Next.js on port 3000
- `npm run db:init` — apply migrations
- `npm run remotion:studio` — Remotion Studio
- `npm run remotion:render` — podcast render
- `npm run remotion:render-movie` — movie recap render
