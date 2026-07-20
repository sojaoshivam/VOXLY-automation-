import { NextResponse } from "next/server";
import { processAutoPublish } from "@/lib/auto-publish";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/** Vercel cron: auto-publish cloud-ready videos to configured platforms. */
export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await processAutoPublish();
  return NextResponse.json({ processed: results.length, results });
}
