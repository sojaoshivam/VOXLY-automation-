import { NextResponse } from "next/server";
import { verifyState } from "@/lib/oauth-state";
import { exchangeInstagramCode } from "@/lib/instagram";
import { upsertSocialAccount } from "@/lib/social-accounts";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) return NextResponse.redirect(`${origin}/accounts?error=${error}`);
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/accounts?error=missing_code`);
  }

  try {
    const userId = verifyState(state);
    const account = await exchangeInstagramCode(code);
    await upsertSocialAccount(userId, "instagram", account);
    return NextResponse.redirect(`${origin}/accounts?connected=instagram`);
  } catch (err) {
    return NextResponse.redirect(
      `${origin}/accounts?error=${encodeURIComponent(err.message)}`
    );
  }
}
