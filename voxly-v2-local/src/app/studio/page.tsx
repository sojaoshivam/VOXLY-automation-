import { IngestForm } from "@/components/IngestForm";
import { Video } from "lucide-react";

export default function StudioPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto w-full space-y-6">
      <div className="flex items-center gap-3 border-b border-[#121222]/80 pb-6">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white">
          <Video className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Podcast Studio</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Talking-head ingest → transcribe → podcast render → upload MP4 to R2.
          </p>
        </div>
      </div>
      <IngestForm />
    </div>
  );
}
