import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2",
        {
          "border-transparent bg-white text-zinc-950 shadow hover:bg-white/80": variant === "default",
          "border-transparent bg-zinc-800 text-zinc-100 hover:bg-zinc-800/80": variant === "secondary",
          "border-transparent bg-red-950/40 text-red-400 border-red-900/50": variant === "destructive",
          "border-zinc-800 text-zinc-300": variant === "outline",
          "border-emerald-900/50 bg-emerald-950/40 text-emerald-400": variant === "success",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
