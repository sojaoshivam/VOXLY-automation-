import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { createPgPool } from "@/lib/db-pool";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is required. Set the SAME PostgreSQL connection string used by voxly-v2-local in .env.local"
  );
}

// Reuse the pool across hot reloads in dev to avoid exhausting connections.
const globalForDb = globalThis;
const pool = globalForDb.__voxlyPgPool ?? createPgPool(connectionString);
if (process.env.NODE_ENV !== "production") globalForDb.__voxlyPgPool = pool;

export const db = drizzle(pool, { schema });
