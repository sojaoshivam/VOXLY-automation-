import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { suggestPublishTimes } from "@/lib/publish-time";

export async function GET(request) {
  try {
    await requireUserId();
    const platforms = new URL(request.url).searchParams.get("platforms");
    const list = platforms ? platforms.split(",").filter(Boolean) : ["youtube", "instagram"];
    return NextResponse.json(suggestPublishTimes(list));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
