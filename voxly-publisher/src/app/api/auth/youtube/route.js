import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { signState } from "@/lib/oauth-state";
import { getYoutubeAuthUrl } from "@/lib/youtube";

export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.redirect(getYoutubeAuthUrl(signState(userId)));
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 500 }
    );
  }
}
