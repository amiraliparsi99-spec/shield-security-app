import Link from "next/link";
import { getShieldBlogPosts } from "@/data/shield-blog";

export const metadata = {
  title: "Shield Weekly — Security insights",
  description: "Weekly notes on UK security operations, licensing context, and industry trends.",
};

export default function BlogIndexPage() {
  const posts = getShieldBlogPosts();

  return (
    <div className="min-h-screen bg-[#080a0f] text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/"
          className="text-sm font-semibold text-teal-400/90 hover:text-teal-300"
        >
          ← Back to Shield
        </Link>
        <h1 className="mt-8 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-white">
          Shield Weekly
        </h1>
        <p className="mt-3 text-zinc-400">
          Security industry notes, policy context, and how teams are working on the ground. New
          articles are published weekly.
        </p>
        <ul className="mt-10 space-y-6">
          {posts.map((post) => (
            <li key={post.slug}>
              <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-teal-500/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-400/90">
                  {new Date(post.publishedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  <Link href={`/blog/${post.slug}`} className="hover:underline">
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{post.excerpt}</p>
                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-4 inline-block text-sm font-semibold text-teal-400 hover:text-teal-300"
                >
                  Read article →
                </Link>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
