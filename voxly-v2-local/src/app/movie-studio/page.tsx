import { RecapIngestForm } from "@/components/RecapIngestForm";
import { Clapperboard } from "lucide-react";

export default function MovieStudioPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto w-full space-y-6">
      <div className="flex items-center gap-3 border-b border-[#121222]/80 pb-6">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-700 flex items-center justify-center text-white">
          <Clapperboard className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Movie Studio</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Clip → transcript → AI script → Sarvam voice → render → R2.
          </p>
        </div>
      </div>
      <RecapIngestForm />
    </div>
  );
}
