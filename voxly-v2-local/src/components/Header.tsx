"use client";

import { Cpu } from "lucide-react";

export function Header() {
  return (
    <header className="h-14 border-b border-[#121222]/80 bg-[#07070c]/80 flex items-center px-6 shrink-0">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Cpu className="h-4 w-4 text-violet-400" />
        <span>Local render engine · FFmpeg + R2</span>
      </div>
    </header>
  );
}
