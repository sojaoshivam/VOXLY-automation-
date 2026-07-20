# Movie Recap Workflow

This guide covers sourcing movie clips and running them through Voxly's **Movie Clips** engine (separate from the **Podcast Clips** engine).

## Two engines in Voxly Local

| Section | Route | Purpose |
|---------|-------|---------|
| **Podcast Clips** | `/studio` | Talking-head shorts with optional BGM and Pexels b-roll |
| **Movie Clips** | `/movie-studio` | AI recap shorts from a single movie scene clip |

Both share the same Postgres `video_projects` table and R2 upload; publishing uses `voxly-publisher` unchanged.

---

## Phase 1 — Source your clip (outside Voxly)

Use legally sourced media only:

- **Internet Archive** ([archive.org](https://archive.org)) — public domain / vintage film
- **PlayPhrase.me / Yarn** — find exact lines; download manually and import
- **HandBrake** — rip owned Blu-ray/DVD with RF 18–22, preserve source FPS
- **Pexels / Pixabay** — cinematic B-roll if you extend clips later

Do **not** capture DRM streaming (Netflix, Prime, etc.).

### FFmpeg trim (optional pre-step)

```bash
ffmpeg -ss 00:45:12 -i input_movie.mp4 -t 00:00:30 -c:v copy -c:a copy scene_clip.mp4
```

Keep clips **≤ 60 seconds** for Shorts.

---

## Phase 2 — Voxly Movie Studio flow

1. Open **Movie Studio** (`/movie-studio`)
2. Upload title + MP4 (≤60s)
3. Voxly transcribes clip dialogue → `sourceTranscriptData`
4. Click **Generate** script — LLM writes timed explainer narration (new words, not quotes)
5. Edit segments in the script editor; **Save**
6. Click **Generate voiceover (Sarvam)** — Bulbul v3 `en-IN`, speaker `shubh`
7. Voxly transcribes Sarvam audio for captions
8. Pick caption theme → **Render vertical short**
9. MP4 uploads to R2 → publish via `voxly-publisher`

---

## Environment variables

Add to `.env`:

```env
SARVAM_API_KEY=your_key
# Optional:
# SARVAM_LANGUAGE=en-IN
# SARVAM_SPEAKER=shubh

GEMINI_API_KEY=...        # or OPENROUTER_API_KEY for script generation
DEEPGRAM_API_KEY=...      # clip + voiceover transcription
```

---

## API routes (movie engine only)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/recap/upload` | POST | Create movie recap project |
| `/api/recap/transcribe` | POST | Transcribe clip → source transcript |
| `/api/recap/generate-script` | POST | LLM timed recap script |
| `/api/recap/script` | PUT | Save edited script |
| `/api/recap/generate-voice` | POST | Sarvam TTS + concat |
| `/api/recap/transcribe-voiceover` | POST | Caption transcript |
| `/api/recap/render` | POST | Remotion `MovieRecapShort` |
| `/api/recap/render/status` | GET | Poll render completion |

Podcast routes (`/api/upload`, `/api/transcribe`, `/api/render`) are unchanged.

---

## Legal note

Movie recap content should qualify as **commentary / criticism / education** under fair use in your jurisdiction. Voxly does not provide licensed movie footage — you supply clips you have the right to use.
