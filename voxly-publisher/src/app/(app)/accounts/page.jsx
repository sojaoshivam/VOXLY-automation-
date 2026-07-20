import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { socialAccounts } from "@/db/schema";
import AccountsManager from "@/components/AccountsManager";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const accounts = await db
    .select({
      id: socialAccounts.id,
      platform: socialAccounts.platform,
      accountName: socialAccounts.accountName,
      tokenExpiresAt: socialAccounts.tokenExpiresAt,
    })
    .from(socialAccounts)
    .where(eq(socialAccounts.userId, session.user.id));

  return (
    <div>
      <PageHeader
        eyebrow="Accounts"
        title="Connected accounts"
        description="Connect YouTube and Instagram for publishing. Instagram connects through Facebook — required by Meta for Reels API access."
      />
      <AccountsManager initialAccounts={accounts} />
    </div>
  );
}
