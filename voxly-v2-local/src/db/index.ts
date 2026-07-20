import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { createPgPool } from "@/lib/db-pool";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is required. Set a PostgreSQL connection string (e.g. Neon) in .env"
  );
}

const pool = createPgPool(connectionString);

export const db = drizzle(pool, { schema });
