import fs from "fs";
import path from "path";

/**
 * Remotion + FFmpeg on Windows often fail writing under long AppData\Local\Temp paths
 * ("No such file or directory" for remotion-audio-mixing/*.wav). Use a short project-local temp dir.
 */
export function configureRemotionTempDir(): string {
  const tempDir = path.join(process.cwd(), ".remotion-temp");
  fs.mkdirSync(tempDir, { recursive: true });
  process.env.TEMP = tempDir;
  process.env.TMP = tempDir;
  process.env.TMPDIR = tempDir;
  return tempDir;
}

export function remotionTempEnv(): Record<string, string> {
  const tempDir = configureRemotionTempDir();
  return {
    TEMP: tempDir,
    TMP: tempDir,
    TMPDIR: tempDir,
  };
}

export function remotionConcurrency(): number | null {
  return process.platform === "win32" ? 1 : null;
}
