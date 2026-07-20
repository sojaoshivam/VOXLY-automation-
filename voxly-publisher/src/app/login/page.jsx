import { redirect } from "next/navigation";
import { Rocket } from "lucide-react";
import { auth, signIn } from "@/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--voxly-canvas)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--voxly-line)] bg-white p-8 shadow-[0_8px_32px_rgba(23,23,23,0.08)]">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--voxly-accent-soft)] text-[var(--voxly-accent)]">
            <Rocket className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-[var(--voxly-ink)]">
            Voxly Publisher
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--voxly-muted)]">
            Sign in to publish and schedule your videos to YouTube &amp; Instagram.
          </p>
          <form
            className="mt-8 w-full"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-xl bg-[var(--voxly-primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--voxly-primary-hover)]"
            >
              Continue with Google
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
