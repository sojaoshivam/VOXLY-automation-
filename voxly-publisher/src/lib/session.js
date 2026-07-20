import { auth } from "@/auth";

/** Returns the current user's stable id, or null if not signed in. */
export async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Throws a 401-style error if there is no signed-in user; returns userId otherwise. */
export async function requireUserId() {
  const userId = await getUserId();
  if (!userId) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  return userId;
}
