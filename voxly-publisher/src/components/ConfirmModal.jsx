"use client";

import { AlertTriangle, X } from "lucide-react";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#171717]/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Close dialog"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl border border-[var(--voxly-line)] bg-white p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1 text-[var(--voxly-muted)] hover:bg-[var(--voxly-canvas)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              destructive ? "bg-[#fff0ed] text-[var(--voxly-danger)]" : "bg-[var(--voxly-accent-soft)] text-[var(--voxly-accent)]"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-[var(--voxly-ink)]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--voxly-muted)]">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-[var(--voxly-line)] px-4 py-2 text-sm font-semibold text-[var(--voxly-muted)] transition-colors hover:bg-[var(--voxly-canvas)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
              destructive
                ? "bg-[var(--voxly-danger)] hover:bg-[#9a1f16]"
                : "bg-[var(--voxly-ink)] hover:bg-[#2a2927]"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
