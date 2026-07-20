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
  type CaptionTheme,
  type MovieRecapShortProps,
} from "../src/lib/remotion-props";
import { getTranscriptDuration, parseDeepgramWords } from "../src/lib/deepgram";

const FPS = 30;
const COMPOSITION_ID = "MovieRecapShort";
const BUNDLE_CACHE_DIR = path.join(
  process.cwd(),
  "node_modules",
  ".cache",
  "remotion-bundle-movie"
);
const ENTRY_POINT = path.join(process.cwd(), "remotion", "index.ts");

type RenderArgs = {
  projectId: string;
  videoPath: string;
  audioPath: string;
  transcriptJson: string;
  title: string;
  showTitle: boolean;
  outputPath: string;
  theme?: CaptionTheme;
  fontSize?: number;
  activeColor?: string;
};

function parseArgs(): RenderArgs {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const projectId = get("--project-id");
  const videoPath = get("--video-path");
  const audioPath = get("--audio-path");
  const transcriptPath = get("--transcript-path");
  const title = get("--title");
  const outputPath = get("--output-path");

  let transcriptJson = "";
  if (transcriptPath) {
    transcriptJson = fs.readFileSync(path.resolve(transcriptPath), "utf8");
  }

  if (!projectId || !videoPath || !audioPath || !transcriptJson || !title || !outputPath) {
    console.error(
      "Usage: tsx scripts/render-movie-recap.ts",
      "--project-id <id>",
      "--video-path <abs>",
      "--audio-path <abs>",
      "--transcript-path <abs>",
      "--title <title>",
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
    audioPath: path.resolve(audioPath),
    transcriptJson,
    title,
    showTitle: flag("--show-title", true),
    outputPath: path.resolve(outputPath),
    theme: get("--theme") as CaptionTheme | undefined,
    fontSize: get("--font-size") ? Number(get("--font-size")) : undefined,
    activeColor: get("--active-color"),
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

function startMediaServer(
  filePath: string,
  contentType: string
): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
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
          "Content-Type": contentType,
        });
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }

      res.writeHead(200, {
        "Content-Length": total,
        "Accept-Ranges": "bytes",
        "Content-Type": contentType,
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      fs.createReadStream(filePath).pipe(res);
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const assignedPort =
        typeof address === "object" && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${assignedPort}/media`,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

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
      console.log(`[MovieRecap] Reusing cached bundle at ${cachedLocation}`);
      return cachedLocation;
    }
  }

  const serveUrl = await bundle({
    entryPoint: ENTRY_POINT,
    publicDir: path.join(process.cwd(), "remotion-public"),
    webpackOverride: (config) => config,
  });

  fs.mkdirSync(BUNDLE_CACHE_DIR, { recursive: true });
  fs.writeFileSync(bundleMarker, serveUrl, "utf8");
  fs.writeFileSync(fingerprintFile, fingerprint, "utf8");
  return serveUrl;
}

async function main() {
  const args = parseArgs();

  if (!fs.existsSync(args.videoPath)) {
    console.error(`[MovieRecap] Video not found: ${args.videoPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(args.audioPath)) {
    console.error(`[MovieRecap] Audio not found: ${args.audioPath}`);
    process.exit(1);
  }

  const words = parseDeepgramWords(args.transcriptJson);
  if (words.length === 0) {
    console.error("[MovieRecap] No words found in transcript JSON");
    process.exit(1);
  }

  let durationInSeconds = getTranscriptDuration(words);
  try {
    const metadata = await getVideoMetadata(args.videoPath);
    durationInSeconds = metadata.durationInSeconds ?? durationInSeconds;
  } catch {
    console.warn("[MovieRecap] Could not read video metadata; using transcript duration");
  }

  const videoServer = await startMediaServer(args.videoPath, "video/mp4");
  const audioExt = path.extname(args.audioPath).toLowerCase();
  const audioMime = audioExt === ".mp3" ? "audio/mpeg" : "audio/wav";
  const audioServer = await startMediaServer(args.audioPath, audioMime);

  const style = resolveCaptionStyle(args.theme ?? DEFAULT_CAPTION_STYLE.theme, {
    fontSize: args.fontSize ?? DEFAULT_CAPTION_STYLE.fontSize,
    ...(args.activeColor ? { activeColor: args.activeColor } : {}),
  });

  const inputProps: MovieRecapShortProps = {
    videoSrc: videoServer.url,
    audioSrc: audioServer.url,
    words,
    title: args.title,
    showTitle: args.showTitle,
    durationInSeconds,
    style,
  };

  try {
    const serveUrl = await getOrCreateBundle();
    const port = await getFreePort();

    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps,
      port,
    });

    fs.mkdirSync(path.dirname(args.outputPath), { recursive: true });

    console.log(`[MovieRecap] Rendering to ${args.outputPath}...`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: args.outputPath,
      inputProps,
      port,
      concurrency: remotionConcurrency(),
      onProgress: ({ progress }) => {
        if (Math.round(progress * 100) % 10 === 0) {
          console.log(`[MovieRecap] Progress: ${Math.round(progress * 100)}%`);
        }
      },
    });

    console.log(`[MovieRecap] Render complete for project ${args.projectId}`);
  } finally {
    await videoServer.close();
    await audioServer.close();
  }
}

main().catch((err) => {
  console.error("[MovieRecap] Render failed:", err);
  process.exit(1);
});
