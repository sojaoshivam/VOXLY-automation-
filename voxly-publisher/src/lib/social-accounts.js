import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { socialAccounts } from "@/db/schema";
import { encrypt } from "@/lib/crypto";

/**
 * Create or update the connected account for a (user, platform). Tokens are
 * encrypted before they touch the database.
 */
export async function upsertSocialAccount(userId, platform, data) {
  const values = {
    userId,
    platform,
    accountName: data.accountName ?? null,
    accessToken: encrypt(data.accessToken),
    refreshToken: data.refreshToken ? encrypt(data.refreshToken) : null,
    tokenExpiresAt: data.expiresAt ?? null,
    platformAccountId: data.platformAccountId ?? null,
  };

  const [existing] = await db
    .select({ id: socialAccounts.id })
    .from(socialAccounts)
    .where(
      and(eq(socialAccounts.userId, userId), eq(socialAccounts.platform, platform))
    )
    .limit(1);

  if (existing) {
    await db
      .update(socialAccounts)
      .set(values)
      .where(eq(socialAccounts.id, existing.id));
    return existing.id;
  }

  const id = crypto.randomUUID();
  await db.insert(socialAccounts).values({ id, ...values });
  return id;
}
