import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { signState } from "@/lib/oauth-state";
import { getInstagramAuthUrl } from "@/lib/instagram";

export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.redirect(getInstagramAuthUrl(signState(userId)));
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 500 }
    );
  }
}
