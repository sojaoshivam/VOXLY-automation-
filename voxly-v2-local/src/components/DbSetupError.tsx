import Link from "next/link";
import { Database, Terminal } from "lucide-react";

interface DbSetupErrorProps {
  message: string;
}

export function DbSetupError({ message }: DbSetupErrorProps) {
  const isConnectionRefused =
    message.includes("ECONNREFUSED") || message.includes("connect");

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Database className="h-8 w-8 text-amber-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Database not ready</h1>
            <p className="text-sm text-zinc-400">
              Voxly needs PostgreSQL with the MVP schema applied.
            </p>
          </div>
        </div>

        <pre className="text-xs text-red-300/90 bg-black/40 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
          {message}
        </pre>

        {isConnectionRefused ? (
          <div className="text-sm text-zinc-300 space-y-2">
            <p>
              <strong className="text-white">Local Postgres (Docker):</strong>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-zinc-400">
              <li>
                Set in <code className="text-amber-200">.env</code>:{" "}
                <code className="text-xs">
                  DATABASE_URL=postgresql://voxly:voxly@localhost:5432/voxly
                </code>
              </li>
              <li>
                Run <code className="text-amber-200">docker compose up -d</code>
              </li>
              <li>
                Run <code className="text-amber-200">npm run db:init</code>
              </li>
              <li>Restart <code className="text-amber-200">npm run dev</code></li>
            </ol>
            <p className="pt-2">
              Or use a hosted URL (Neon / Supabase) in{" "}
              <code className="text-amber-200">DATABASE_URL</code>, then{" "}
              <code className="text-amber-200">npm run db:init</code>.
            </p>
          </div>
        ) : (
          <div className="text-sm text-zinc-300 space-y-2">
            <p>If tables are missing, initialize the schema:</p>
            <p className="flex items-center gap-2 font-mono text-amber-200">
              <Terminal className="h-4 w-4" />
              npm run db:init
            </p>
          </div>
        )}

        <Link
          href="/studio"
          className="inline-block text-sm text-violet-400 hover:text-violet-300"
        >
          Continue to Studio (after DB is fixed)
        </Link>
      </div>
    </div>
  );
}
