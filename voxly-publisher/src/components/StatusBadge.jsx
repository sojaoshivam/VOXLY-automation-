const STYLES = {
  draft: "border-[#dedbd3] bg-[#f5f4f1] text-[#5d5952]",
  ready: "border-[#b9c7ff] bg-[#eef3ff] text-[#1f4ed8]",
  uploaded: "border-[#b9c7ff] bg-[#eef3ff] text-[#1f4ed8]",
  uploading: "border-[#f2d6a2] bg-[#fff7e8] text-[#8a4b00]",
  processing: "border-[#f2d6a2] bg-[#fff7e8] text-[#8a4b00]",
  scheduled: "border-[#b7d7ff] bg-[#eef7ff] text-[#075da8]",
  publishing: "border-[#f2d6a2] bg-[#fff7e8] text-[#8a4b00]",
  posted: "border-[#b8dccb] bg-[#eefaf4] text-[#0f6f49]",
  live: "border-[#b8dccb] bg-[#eefaf4] text-[#0f6f49]",
  failed: "border-[#f4c7c3] bg-[#fff0ed] text-[#b42318]",
  published_all: "border-[#9ed4b6] bg-[#e8f7ef] text-[#0a5c38]",
  partial: "border-[#d4c4a8] bg-[#faf6ef] text-[#7a5a20]",
};

const LABELS = {
  uploaded: "Ready",
  uploading: "Processing",
  posted: "Live",
  published_all: "Published everywhere",
  partial: "Partially published",
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5 ${STYLES[status] || STYLES.draft}`}
    >
      {LABELS[status] || status}
    </span>
  );
}
