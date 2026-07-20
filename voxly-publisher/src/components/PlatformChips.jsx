import { Check, Circle } from "lucide-react";
import { getPlatformLabel } from "@/lib/publish-coverage";

export default function PlatformChips({ platformStatus = {}, connectedPlatforms = [] }) {
  if (connectedPlatforms.length === 0) {
    return (
      <p className="text-[11px] text-[var(--voxly-muted)]">No accounts connected</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {connectedPlatforms.map((platform) => {
        const info = platformStatus[platform];
        const isPosted = info?.status === "posted";
        const isFailed = info?.status === "failed";
        const isScheduled = info?.status === "scheduled";

        return (
          <span
            key={platform}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
              isPosted
                ? "border-[#b8dccb] bg-[#eefaf4] text-[#0f6f49]"
                : isFailed
                  ? "border-[#f4c7c3] bg-[#fff0ed] text-[var(--voxly-danger)]"
                  : isScheduled
                    ? "border-[#b7d7ff] bg-[#eef7ff] text-[#075da8]"
                    : "border-[var(--voxly-line)] bg-[var(--voxly-canvas)] text-[var(--voxly-muted)]"
            }`}
          >
            {isPosted ? (
              <Check className="h-3 w-3" />
            ) : (
              <Circle className="h-2.5 w-2.5" />
            )}
            {getPlatformLabel(platform)}
          </span>
        );
      })}
    </div>
  );
}
