"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function ProfileForm({ initialProfile, email, image }) {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: initialProfile.displayName || "",
    bio: initialProfile.bio || "",
    timezone: initialProfile.timezone || "America/New_York",
    emailNotifications: initialProfile.emailNotifications ?? true,
    publishReminders: initialProfile.publishReminders ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setNotice({ type: "success", msg: "Profile saved." });
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
        <div className="flex items-center gap-4">
          {image ? (
            <img src={image} alt="" className="h-16 w-16 rounded-full border border-[var(--voxly-line)]" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--voxly-accent-soft)] text-lg font-semibold text-[var(--voxly-accent)]">
              {(form.displayName || email || "?")[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-[var(--voxly-ink)]">{form.displayName || "Your profile"}</p>
            <p className="text-sm text-[var(--voxly-muted)]">{email}</p>
          </div>
        </div>
      </section>

      <section className="voxly-card rounded-2xl border border-[var(--voxly-line)] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--voxly-ink)]">Basic info</h2>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="voxly-label">Display name</label>
            <input
              className="voxly-input mt-2 w-full"
              value={form.displayName}
              onChange={(e) => update("displayName", e.target.value)}
            />
          </div>
          <div>
            <label className="voxly-label">Bio</label>
            <textarea
              className="voxly-input mt-2 min-h-24 w-full resize-y"
              value={form.bio}
              onChange={(e) => update("bio", e.target.value)}
              placeholder="A short bio for your publishing workspace."
            />
          </div>
          <div>
            <label className="voxly-label">Timezone</label>
            <select
              className="voxly-input mt-2 w-full"
              value={form.timezone}
              onChange={(e) => update("timezone", e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="voxly-card rounded-2xl border border-[var(--voxly-line)] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--voxly-ink)]">Notifications</h2>
        <div className="mt-4 space-y-3">
          <label className="flex items-center justify-between rounded-xl border border-[var(--voxly-line)] px-4 py-3">
            <span className="text-sm font-medium text-[var(--voxly-ink)]">Email notifications</span>
            <input
              type="checkbox"
              checked={form.emailNotifications}
              onChange={(e) => update("emailNotifications", e.target.checked)}
              className="toggle toggle-sm"
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-[var(--voxly-line)] px-4 py-3">
            <span className="text-sm font-medium text-[var(--voxly-ink)]">Publish reminders</span>
            <input
              type="checkbox"
              checked={form.publishReminders}
              onChange={(e) => update("publishReminders", e.target.checked)}
              className="toggle toggle-sm"
            />
          </label>
        </div>
      </section>

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--voxly-ink)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2a2927] disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {busy ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
}
