import Link from "next/link";

export default function AgencySignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#080a0f]">
      <div className="text-center px-6 max-w-md">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-500/10 text-5xl mb-6">
          🏛️
        </div>
        <h1 className="font-display text-3xl font-bold text-white">Agency Registration</h1>
        <p className="mt-3 text-zinc-400">
          Agency sign-up is not available yet. We&apos;re building the full agency experience and will let you know when it&apos;s ready.
        </p>
        <span className="mt-6 inline-flex items-center rounded-full bg-blue-500/10 border border-blue-500/20 px-5 py-2 text-sm font-medium text-blue-400">
          Coming Soon
        </span>
        <div className="mt-8">
          <Link href="/signup" className="text-sm text-zinc-500 hover:text-white transition">
            ← Back to sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
