import path from "path";
import fs from "fs";
import net from "net";
import http from "http";
import { loadEnvFile } from "../src/lib/load-env-file";
import { configureRemotionTempDir, remotionConcurrency } from "../src/lib/remotion-temp";
import { bundle } from "@remotion/bundler";

loadEnvFile();
configureRemotionTempDir();
import { getVideoMetadata, renderMedia, selectComposition } from "@remotion/renderer";
import {
  DEFAULT_CAPTION_STYLE,
  resolveCaptionStyle,
  type BackgroundOption,
  type CaptionTheme,
  type PodcastShortProps,
} from "../src/lib/remotion-props";
import {
  buildCaptionBlocks,
  getTranscriptDuration,
  parseDeepgramWords,
} from "../src/lib/deepgram";
import { buildBrollPlan } from "../src/lib/broll";
import {
  detectFaceFocal,
  PODCAST_FOCAL_FALLBACK,
} from "../src/lib/face-focal";

const FPS = 30;

const COMPOSITION_ID = "PodcastShort";
const BUNDLE_CACHE_DIR = path.join(
  process.cwd(),
  "node_modules",
  ".cache",
  "remotion-bundle"
);
const ENTRY_POINT = path.join(process.cwd(), "remotion", "index.ts");

type RenderArgs = {
  projectId: string;
  videoPath: string;
  transcriptJson: string;
  title: string;
  showTitle: boolean;
  backgroundOption: BackgroundOption;
  outputPath: string;
  theme?: CaptionTheme;
  fontSize?: number;
  activeColor?: string;
  inactiveColor?: string;
  fontFamily?: string;
  enableZoom: boolean;
  enableBroll: boolean;
  autoFraming: boolean;
  focalXOffset: number;
  focalYOffset: number;
  lowPerfMode: boolean;
};

function parseArgs(): RenderArgs {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const projectId = get("--project-id");
  const videoPath = get("--video-path");
  const transcriptPath = get("--transcript-path");
  const transcriptJsonInline = get("--transcript-json");
  const title = get("--title");
  const backgroundOption = (get("--background") || "blur") as BackgroundOption;
  const outputPath = get("--output-path");

  let transcriptJson = transcriptJsonInline || "";
  if (transcriptPath) {
    transcriptJson = fs.readFileSync(path.resolve(transcriptPath), "utf8");
  }

  if (!projectId || !videoPath || !transcriptJson || !title || !outputPath) {
    console.error(
      "Usage: tsx scripts/render-remotion.ts",
      "--project-id <id>",
      "--video-path <abs>",
      "--transcript-path <abs> | --transcript-json <json>",
      "--title <title>",
      "--background blur|white|black",
      "--output-path <abs>"
    );
    process.exit(1);
  }

  const flag = (name: string, fallback: boolean): boolean => {
    const value = get(name);
    if (value === undefined) return fallback;
    return value !== "false" && value !== "0";
  };

  return {
    projectId,
    videoPath: path.resolve(videoPath),
    transcriptJson,
    title,
    showTitle: flag("--show-title", true),
    backgroundOption,
    outputPath: path.resolve(outputPath),
    theme: get("--theme") as CaptionTheme | undefined,
    fontSize: get("--font-size") ? Number(get("--font-size")) : undefined,
    activeColor: get("--active-color"),
    inactiveColor: get("--inactive-color"),
    fontFamily: get("--font-family"),
    enableZoom: flag("--zoom", true),
    enableBroll: flag("--broll", Boolean(process.env.PEXELS_API_KEY)),
    autoFraming: flag("--auto-framing", true),
    focalXOffset: get("--focal-x") ? Number(get("--focal-x")) : 0,
    focalYOffset: get("--focal-y") ? Number(get("--focal-y")) : 0,
    lowPerfMode: flag("--low-perf", false),
  };
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Remotion's OffthreadVideo cannot read `file://` paths — it only fetches
 * http(s) URLs. We serve the single source video over a tiny local HTTP server
 * (with Range support) so the renderer's compositor can download it. This keeps
 * the render self-contained and independent of the Next.js server.
 */
function startVideoServer(
  videoPath: string
): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let stat: fs.Stats;
      try {
        stat = fs.statSync(videoPath);
      } catch {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const total = stat.size;
      const range = req.headers.range;

      if (range) {
        const match = /bytes=(\d+)-(\d*)/.exec(range);
        const start = match ? parseInt(match[1], 10) : 0;
        const end = match && match[2] ? parseInt(match[2], 10) : total - 1;
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
          "Content-Type": "video/mp4",
        });
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        fs.createReadStream(videoPath, { start, end }).pipe(res);
        return;
      }

      res.writeHead(200, {
        "Content-Length": total,
        "Accept-Ranges": "bytes",
        "Content-Type": "video/mp4",
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      fs.createReadStream(videoPath).pipe(res);
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const assignedPort =
        typeof address === "object" && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${assignedPort}/video.mp4`,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

function mimeForBroll(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".png") return "image/png";
  return "image/jpeg";
}

/** Serve downloaded b-roll media over HTTP (Remotion cannot load local file paths). */
function startBrollServer(
  localPaths: string[]
): Promise<{
  urlFor: (localPath: string) => string;
  close: () => Promise<void>;
}> {
  const fileMap = new Map(
    localPaths.map((p) => [path.basename(p), path.resolve(p)])
  );

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const name = path.basename((req.url || "/").split("?")[0]);
      const filePath = fileMap.get(name);
      if (!filePath || !fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": mimeForBroll(filePath),
        "Content-Length": fs.statSync(filePath).size,
      });
      fs.createReadStream(filePath).pipe(res);
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const assignedPort =
        typeof address === "object" && address ? address.port : 0;
      resolve({
        urlFor: (localPath: string) =>
          `http://127.0.0.1:${assignedPort}/${path.basename(localPath)}`,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

/**
 * Fingerprint of all Remotion source files so the cached bundle is invalidated
 * whenever composition code changes (otherwise edits are silently ignored).
 */
function getSourceFingerprint(): string {
  const dirs = [
    path.join(process.cwd(), "remotion"),
    path.join(process.cwd(), "src", "lib"),
  ];
  const parts: string[] = [];

  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const stat = fs.statSync(full);
        parts.push(`${full}:${stat.mtimeMs}:${stat.size}`);
      }
    }
  };

  dirs.forEach(walk);
  return parts.sort().join("|");
}

async function getOrCreateBundle(): Promise<string> {
  const bundleMarker = path.join(BUNDLE_CACHE_DIR, ".bundle-location");
  const fingerprintFile = path.join(BUNDLE_CACHE_DIR, ".bundle-fingerprint");
  const fingerprint = getSourceFingerprint();

  if (fs.existsSync(bundleMarker) && fs.existsSync(fingerprintFile)) {
    const cachedLocation = fs.readFileSync(bundleMarker, "utf8").trim();
    const cachedFingerprint = fs.readFileSync(fingerprintFile, "utf8").trim();
    if (
      cachedLocation &&
      fs.existsSync(cachedLocation) &&
      cachedFingerprint === fingerprint
    ) {
      console.log(`[Remotion] Reusing cached bundle at ${cachedLocation}`);
      return cachedLocation;
    }
    console.log("[Remotion] Source changed — rebundling composition...");
  } else {
    console.log("[Remotion] Bundling composition (first run may take 15–30s)...");
  }

  const serveUrl = await bundle({
    entryPoint: ENTRY_POINT,
    publicDir: path.join(process.cwd(), "remotion-public"),
    webpackOverride: (config) => config,
  });

  fs.mkdirSync(BUNDLE_CACHE_DIR, { recursive: true });
  fs.writeFileSync(bundleMarker, serveUrl, "utf8");
  fs.writeFileSync(fingerprintFile, fingerprint, "utf8");
  console.log(`[Remotion] Bundle ready at ${serveUrl}`);
  return serveUrl;
}

async function main() {
  const args = parseArgs();

  if (!fs.existsSync(args.videoPath)) {
    console.error(`[Remotion] Video not found: ${args.videoPath}`);
    process.exit(1);
  }

  const words = parseDeepgramWords(args.transcriptJson);
  if (words.length === 0) {
    console.error("[Remotion] No words found in transcript JSON");
    process.exit(1);
  }

  let durationInSeconds = getTranscriptDuration(words);
  try {
    const metadata = await getVideoMetadata(args.videoPath);
    durationInSeconds = metadata.durationInSeconds ?? durationInSeconds;
  } catch {
    console.warn("[Remotion] Could not read video metadata; using transcript duration");
  }

  const videoServer = await startVideoServer(args.videoPath);
  console.log(`[Remotion] Serving source video at ${videoServer.url}`);

  let focalXOffset = args.focalXOffset;
  let focalYOffset = args.focalYOffset;

  if (args.autoFraming && focalXOffset === 0 && focalYOffset === 0) {
    console.log("[Remotion] Auto face framing...");
    const detected = await detectFaceFocal(args.videoPath, durationInSeconds);
    if (detected) {
      focalXOffset = detected.focalXOffset;
      focalYOffset = detected.focalYOffset;
    } else {
      focalXOffset = PODCAST_FOCAL_FALLBACK.focalXOffset;
      focalYOffset = PODCAST_FOCAL_FALLBACK.focalYOffset;
      console.log("[Remotion] Using podcast focal fallback");
    }
  }

  const style = resolveCaptionStyle(args.theme ?? DEFAULT_CAPTION_STYLE.theme, {
    fontSize: args.fontSize ?? DEFAULT_CAPTION_STYLE.fontSize,
    ...(args.activeColor ? { activeColor: args.activeColor } : {}),
    ...(args.inactiveColor ? { inactiveColor: args.inactiveColor } : {}),
    ...(args.fontFamily ? { fontFamily: args.fontFamily } : {}),
  });

  let broll: PodcastShortProps["broll"] = [];
  let brollServer: Awaited<ReturnType<typeof startBrollServer>> | null = null;

  if (args.enableBroll) {
    const captionBlocks = buildCaptionBlocks(words, { fps: FPS });
    const rawBroll = await buildBrollPlan(captionBlocks, {
      enabled: true,
      fps: FPS,
      projectId: args.projectId,
      title: args.title,
    });
    console.log(`[Remotion] B-roll items: ${rawBroll.length}`);

    if (rawBroll.length > 0) {
      brollServer = await startBrollServer(rawBroll.map((b) => b.url));
      broll = rawBroll.map((item) => ({
        ...item,
        url: brollServer!.urlFor(item.url),
      }));
    }
  }

  const inputProps: PodcastShortProps = {
    videoSrc: videoServer.url,
    words,
    title: args.title,
    showTitle: args.showTitle,
    backgroundOption: args.backgroundOption,
    durationInSeconds,
    style,
    enableZoom: args.enableZoom,
    focalXOffset,
    focalYOffset,
    lowPerfMode: args.lowPerfMode,
    broll,
  };

  try {
    const serveUrl = await getOrCreateBundle();

    // Use a free port so Remotion's internal server doesn't collide with the
    // Next.js dev server (which occupies the default port 3000).
    const port = await getFreePort();

    console.log(`[Remotion] Selecting composition "${COMPOSITION_ID}" on port ${port}...`);
    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps,
      port,
    });

    fs.mkdirSync(path.dirname(args.outputPath), { recursive: true });

    console.log(`[Remotion] Rendering to ${args.outputPath}...`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: args.outputPath,
      inputProps,
      port,
      // Perf budget: use available cores for frame splitting. null lets Remotion
      // pick a sensible default based on the host machine.
      concurrency: remotionConcurrency(),
      onProgress: ({ progress }) => {
        if (Math.round(progress * 100) % 10 === 0) {
          console.log(`[Remotion] Progress: ${Math.round(progress * 100)}%`);
        }
      },
    });

    console.log(`[Remotion] Render complete for project ${args.projectId}`);
  } finally {
    await videoServer.close();
    if (brollServer) await brollServer.close();
  }
}

main().catch((err) => {
  console.error("[Remotion] Render failed:", err);
  process.exit(1);
});
