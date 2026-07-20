import { Pool, type PoolConfig } from "pg";

export function createPgPool(connectionString: string): Pool {
  const isLocal =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");

  const config: PoolConfig = {
    connectionString,
  };

  if (!isLocal) {
    config.ssl = { rejectUnauthorized: false };
  }

  return new Pool(config);
}
