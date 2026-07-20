"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Sparkles, Zap, Video, Camera } from "lucide-react";

const AI_MODELS = [
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini (fast, low cost)" },
  { value: "openai/gpt-4o", label: "GPT-4o (higher quality)" },
  { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
];

const CATEGORIES = ["Short-form", "Education", "Product", "Announcement"];
const VISIBILITY = ["public", "private", "unlisted"];

const AUTO_PUBLISH_PLATFORMS = [
  { key: "youtube", label: "YouTube Shorts", Icon: Video },
  { key: "instagram", label: "Instagram Reels", Icon: Camera },
];

function parsePlatforms(raw) {
  if (!raw) return ["youtube", "instagram"];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : ["youtube", "instagram"];
  } catch {
    return ["youtube", "instagram"];
  }
}

export default function SettingsForm({ initialSettings }) {
  const router = useRouter();
  const [form, setForm] = useState({
    aiAutoGenerate: initialSettings.aiAutoGenerate ?? false,
    aiModel: initialSettings.aiModel || "openai/gpt-4o-mini",
    defaultVisibility: initialSettings.defaultVisibility || "public",
    defaultCategory: initialSettings.defaultCategory || "Short-form",
    autoPublishEnabled: initialSettings.autoPublishEnabled ?? false,
    autoPublishPlatforms: parsePlatforms(initialSettings.autoPublishPlatforms),
    autoPublishScheduleMode: initialSettings.autoPublishScheduleMode || "interval",
    autoPublishIntervalHours: initialSettings.autoPublishIntervalHours ?? 6,
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleAutoPublishPlatform(platform) {
    setForm((prev) => {
      const current = prev.autoPublishPlatforms;
      const next = current.includes(platform)
        ? current.filter((p) => p !== platform)
        : [...current, platform];
      return { ...prev, autoPublishPlatforms: next };
    });
  }

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          autoPublishPlatforms: JSON.stringify(form.autoPublishPlatforms),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setNotice({ type: "success", msg: "Settings saved." });
      router.refresh();
    } catch (err) {
      setNotice({ type: "error", msg: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
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

      <section className="voxly-card rounded-2xl border border-[var(--voxly-line)] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--voxly-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--voxly-ink)]">AI configuration</h2>
        </div>
        <p className="mt-2 text-sm text-[var(--voxly-muted)]">
          Configure how AI generates titles, captions, and tags. Requires OPENROUTER_API_KEY on the server.
        </p>
        <div className="mt-4 grid gap-4">
          <label className="flex items-center justify-between rounded-xl border border-[var(--voxly-line)] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[var(--voxly-ink)]">Auto-generate on publish</p>
              <p className="text-xs text-[var(--voxly-muted)]">Generate metadata when opening the publish flow</p>
            </div>
            <input
              type="checkbox"
              checked={form.aiAutoGenerate}
              onChange={(e) => update("aiAutoGenerate", e.target.checked)}
              className="toggle toggle-sm"
            />
          </label>
          <div>
            <label className="voxly-label">AI model</label>
            <select
              className="voxly-input mt-2 w-full"
              value={form.aiModel}
              onChange={(e) => update("aiModel", e.target.value)}
            >
              {AI_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="voxly-card rounded-2xl border border-[var(--voxly-line)] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-[var(--voxly-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--voxly-ink)]">Auto-publish</h2>
        </div>
        <p className="mt-2 text-sm text-[var(--voxly-muted)]">
          Automatically schedule cloud-ready videos for connected platforms. A background job
          checks every 5 minutes and publishes when your chosen time arrives.
        </p>
        <div className="mt-4 grid gap-4">
          <label className="flex items-center justify-between rounded-xl border border-[var(--voxly-line)] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[var(--voxly-ink)]">Enable auto-publish</p>
              <p className="text-xs text-[var(--voxly-muted)]">
                Queue cloud-ready videos without manual action
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.autoPublishEnabled}
              onChange={(e) => update("autoPublishEnabled", e.target.checked)}
              className="toggle toggle-sm"
            />
          </label>

          {form.autoPublishEnabled && (
            <>
              <div>
                <p className="voxly-label mb-3">Posting schedule</p>
                <div className="grid gap-2">
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                      form.autoPublishScheduleMode === "interval"
                        ? "border-[var(--voxly-accent)] bg-[#f0f7ff]"
                        : "border-[var(--voxly-line)] hover:bg-[var(--voxly-canvas)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="autoPublishScheduleMode"
                      checked={form.autoPublishScheduleMode === "interval"}
                      onChange={() => update("autoPublishScheduleMode", "interval")}
                      className="radio radio-sm mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--voxly-ink)]">
                        Post every{" "}
                        <input
                          type="number"
                          min={1}
                          max={168}
                          value={form.autoPublishIntervalHours}
                          onChange={(e) =>
                            update("autoPublishIntervalHours", Number(e.target.value) || 6)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="voxly-input mx-1 inline-block w-16 px-2 py-1 text-center text-sm"
                        />
                        hours
                      </p>
                      <p className="mt-1 text-xs text-[var(--voxly-muted)]">
                        Releases one video at a time, spaced by your interval (1–168 hours).
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                      form.autoPublishScheduleMode === "ai_optimal"
                        ? "border-[var(--voxly-accent)] bg-[#f0f7ff]"
                        : "border-[var(--voxly-line)] hover:bg-[var(--voxly-canvas)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="autoPublishScheduleMode"
                      checked={form.autoPublishScheduleMode === "ai_optimal"}
                      onChange={() => update("autoPublishScheduleMode", "ai_optimal")}
                      className="radio radio-sm mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-[var(--voxly-ink)]">
                        AI optimal times
                      </p>
                      <p className="mt-1 text-xs text-[var(--voxly-muted)]">
                        AI picks the best publish window per platform to maximize reach. Uses your
                        profile timezone and requires OPENROUTER_API_KEY.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <p className="voxly-label mb-2">Platforms</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {AUTO_PUBLISH_PLATFORMS.map(({ key, label, Icon }) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--voxly-line)] px-4 py-3 hover:bg-[var(--voxly-canvas)]"
                  >
                    <input
                      type="checkbox"
                      checked={form.autoPublishPlatforms.includes(key)}
                      onChange={() => toggleAutoPublishPlatform(key)}
                      className="checkbox checkbox-sm"
                    />
                    <Icon className="h-4 w-4 text-[var(--voxly-muted)]" />
                    <span className="text-sm font-medium text-[var(--voxly-ink)]">{label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--voxly-muted)]">
                Connect accounts in{" "}
                <a href="/accounts" className="font-medium text-[var(--voxly-accent)] hover:underline">
                  Accounts
                </a>
                . Uses AI captions when auto-generate is enabled. View queued posts on{" "}
                <a href="/schedule" className="font-medium text-[var(--voxly-accent)] hover:underline">
                  Schedule
                </a>
                .
              </p>
            </div>
            </>
          )}
        </div>
      </section>

      <section className="voxly-card rounded-2xl border border-[var(--voxly-line)] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--voxly-ink)]">Publishing defaults</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="voxly-label">Default category</label>
            <select
              className="voxly-input mt-2 w-full"
              value={form.defaultCategory}
              onChange={(e) => update("defaultCategory", e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="voxly-label">Default visibility</label>
            <select
              className="voxly-input mt-2 w-full"
              value={form.defaultVisibility}
              onChange={(e) => update("defaultVisibility", e.target.value)}
            >
              {VISIBILITY.map((v) => (
                <option key={v} value={v}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--voxly-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--voxly-primary-hover)] disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {busy ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
