"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Video, Camera, Trash2, Plus } from "lucide-react";

const PLATFORMS = [
  {
    key: "youtube",
    label: "YouTube",
    Icon: Video,
    accent: "text-[#d92d20]",
    connectUrl: "/api/auth/youtube",
    connectLabel: "Connect YouTube",
  },
  {
    key: "instagram",
    label: "Instagram",
    Icon: Camera,
    accent: "text-[#c11574]",
    connectUrl: "/api/auth/instagram",
    connectLabel: "Connect via Facebook",
    note:
      "Meta requires Facebook Login to publish Reels. You will be redirected to facebook.com — this is normal. After signing in, we link your Instagram Business or Creator account through your Facebook Page.",
    requirements: [
      "Instagram Business or Creator account (not personal)",
      "Instagram linked to a Facebook Page",
      "Admin access to that Facebook Page",
    ],
  },
];

export default function AccountsManager({ initialAccounts }) {
  const router = useRouter();
  const params = useSearchParams();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) setNotice({ type: "success", msg: `Connected ${connected}.` });
    else if (error) setNotice({ type: "error", msg: decodeURIComponent(error) });
  }, [params]);

  async function disconnect(id) {
    await fetch(`/api/social-accounts?id=${id}`, { method: "DELETE" });
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            notice.type === "error"
              ? "border-[#f4c7c3] bg-[#fff0ed] text-[var(--voxly-danger)]"
              : "border-[#b8dccb] bg-[#eefaf4] text-[var(--voxly-success)]"
          }`}
        >
          {notice.msg}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {PLATFORMS.map(({ key, label, Icon, accent, connectUrl, connectLabel, note, requirements }) => {
          const connected = accounts.filter((a) => a.platform === key);
          return (
            <div
              key={key}
              className="voxly-card rounded-2xl border border-[var(--voxly-line)] bg-white p-6 shadow-sm"
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--voxly-ink)]">
                <Icon className={`h-5 w-5 ${accent}`} />
                {label}
              </h2>

              {note && connected.length === 0 && (
                <p className="mt-3 text-sm leading-relaxed text-[var(--voxly-muted)]">{note}</p>
              )}

              {requirements && connected.length === 0 && (
                <ul className="mt-3 space-y-1.5 text-xs text-[var(--voxly-muted)]">
                  {requirements.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-[var(--voxly-accent)]">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              {connected.length === 0 && !note && (
                <p className="mt-3 text-sm text-[var(--voxly-muted)]">Not connected.</p>
              )}

              {connected.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {connected.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between rounded-xl border border-[var(--voxly-line)] bg-[var(--voxly-canvas)] px-3 py-2.5"
                    >
                      <span className="text-sm font-medium text-[var(--voxly-ink)]">
                        {a.accountName || "Account"}
                      </span>
                      <button
                        type="button"
                        onClick={() => disconnect(a.id)}
                        className="rounded-lg p-1.5 text-[var(--voxly-danger)] transition-colors hover:bg-[#fff0ed]"
                        aria-label={`Disconnect ${a.accountName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <a
                href={connectUrl}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--voxly-line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--voxly-ink)] transition-colors hover:bg-[var(--voxly-canvas)]"
              >
                <Plus className="h-4 w-4" />
                {connectLabel || `Connect ${label}`}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
