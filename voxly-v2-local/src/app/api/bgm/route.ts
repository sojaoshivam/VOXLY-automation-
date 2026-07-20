import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const bgmDir = path.join(process.cwd(), "public", "bgm");
    
    // Auto-create local BGM folder if it doesn't exist
    if (!fs.existsSync(bgmDir)) {
      fs.mkdirSync(bgmDir, { recursive: true });
      
      // Seed a few dummy instruction text files or placeholders so they see how to use it
      fs.writeFileSync(
        path.join(bgmDir, "lofi_ambient_vibes.mp3"),
        Buffer.alloc(0) // Empty placeholder file
      );
      fs.writeFileSync(
        path.join(bgmDir, "upbeat_growth_hype.mp3"),
        Buffer.alloc(0) // Empty placeholder file
      );
    }

    // Read BGM playlist directory
    const files = fs.readdirSync(bgmDir);
    
    // Filter only audio files (mp3, wav, m4a, etc.) and check that they are valid size (> 1MB)
    const audioFiles = files.filter((f) => {
      const fullPath = path.join(bgmDir, f);
      try {
        const stats = fs.statSync(fullPath);
        return stats.isFile() && stats.size > 1024 * 1024 && /\.(mp3|wav|m4a|ogg|aac)$/i.test(f);
      } catch (e) {
        return false;
      }
    });

    return NextResponse.json({
      success: true,
      playlistPath: "public/bgm",
      tracks: audioFiles
    });
  } catch (error: any) {
    console.error("Failed to list local BGM files:", error);
    return NextResponse.json(
      { error: "Failed to read local BGM playlist files." },
      { status: 500 }
    );
  }
}
