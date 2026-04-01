import Link from "next/link";

export default function PartnersPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
      </div>

      <div className="text-center px-6 max-w-md">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-500/10 text-5xl mb-6">
          🤝
        </div>
        <h1 className="font-display text-3xl font-bold text-white">Agency Partnerships</h1>
        <p className="mt-3 text-zinc-400">
          We&apos;re building the agency partnership program. Soon you&apos;ll be able to partner with Shield HQ, manage your team, and access new venue clients — all from one platform.
        </p>
        <span className="mt-6 inline-flex items-center rounded-full bg-blue-500/10 border border-blue-500/20 px-5 py-2 text-sm font-medium text-blue-400">
          Coming Soon
        </span>
        <div className="mt-8">
          <Link href="/" className="text-sm text-zinc-500 hover:text-white transition">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
