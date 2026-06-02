import Link from "next/link";
import { notFound } from "next/navigation";
import { getShieldBlogPost, getShieldBlogPosts } from "@/data/shield-blog";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getShieldBlogPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = getShieldBlogPost(slug);
  if (!post) return { title: "Article" };
  return {
    title: `${post.title} — Shield Weekly`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getShieldBlogPost(slug);
  if (!post) notFound();

  const paragraphs = post.content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="min-h-screen bg-[#080a0f] text-zinc-100">
      <article className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/blog" className="text-sm font-semibold text-teal-400/90 hover:text-teal-300">
          ← All articles
        </Link>
        <p className="mt-8 text-sm text-zinc-500">
          {new Date(post.publishedAt).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-white">
          {post.title}
        </h1>
        {post.tags && post.tags.length > 0 ? (
          <p className="mt-3 text-sm text-teal-400/90">{post.tags.join(" · ")}</p>
        ) : null}
        <div className="prose prose-invert prose-p:text-zinc-300 mt-10 max-w-none">
          {paragraphs.map((para, i) => (
            <p key={i} className="mb-4 text-[15px] leading-relaxed text-zinc-300">
              {para}
            </p>
          ))}
        </div>
      </article>
    </div>
  );
}
