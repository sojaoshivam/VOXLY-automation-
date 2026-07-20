import crypto from "crypto";

function secret() {
  return process.env.NEXTAUTH_SECRET || process.env.TOKEN_ENCRYPTION_KEY || "dev-secret";
}

/** Sign the userId into the OAuth `state` param so the callback can't be forged. */
export function signState(userId) {
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${userId}:${nonce}`;
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

/** Verify a state value and return the userId it was signed with. */
export function verifyState(state) {
  const decoded = Buffer.from(state, "base64url").toString("utf8");
  const [userId, nonce, sig] = decoded.split(":");
  if (!userId || !nonce || !sig) throw new Error("Invalid OAuth state");
  const expected = crypto
    .createHmac("sha256", secret())
    .update(`${userId}:${nonce}`)
    .digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error("OAuth state signature mismatch");
  }
  return userId;
}
