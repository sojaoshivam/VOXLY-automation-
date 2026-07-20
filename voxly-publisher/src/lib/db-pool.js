import { Pool } from "pg";

/** Create a pg Pool. Disables strict TLS verification for hosted (non-local) DBs like Neon. */
export function createPgPool(connectionString) {
  const isLocal =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");

  const config = { connectionString };
  if (!isLocal) config.ssl = { rejectUnauthorized: false };

  return new Pool(config);
}
